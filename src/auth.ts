const API_BASE = "https://anicount-api.traone.workers.dev";
const TOKEN_KEY = "anicount-auth-token";
const USER_KEY = "anicount-auth-user";
const SYNC_STATE_KEY = "anicount-sync-state";
const REVISION_KEY = "anicount-watchlist-revision";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
};

type TokenPayload = {
  sub: string;
  email: string;
  name?: string;
  iat: number;
  exp: number;
};

function base64UrlDecode(str: string): string {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  // Decode as UTF-8 so non-Latin names survive.
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    return JSON.parse(base64UrlDecode(parts[1])) as TokenPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeTokenPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}

export function getStoredToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || isTokenExpired(token)) {
      clearAuth();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    if (!getStoredToken()) return null;
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// ─── Redirect sign-in ────────────────────────────────────────────────────────
// Our own button sends the page to Google's OpenID Connect sign-in, which posts the
// ID token to the API, which redirects back here with the session in the URL
// fragment. No popup or Google script is involved, so pop-up blockers and in-app
// browsers can't break it, and the button can follow Design.md.

const GOOGLE_CLIENT_ID = "1004921240672-ong7k2d2fv3t1n6nfoen7d5cit6vptfi.apps.googleusercontent.com";
const GOOGLE_LOGIN_URI = `${API_BASE}/auth/google/redirect`;
const LOGIN_NONCE_KEY = "anicount-login-nonce";

export function startGoogleSignIn(): void {
  const nonce = getLoginNonce();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_LOGIN_URI,
    response_type: "id_token",
    response_mode: "form_post",
    scope: "openid email profile",
    nonce,
    // Echoed back even when the user cancels, so the API knows which app to return to.
    state: nonce,
    prompt: "select_account",
  });
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

/**
 * A per-tab nonce that Google embeds in the ID token and the API echoes back.
 * Matching it proves this tab started the sign-in (login CSRF protection). The
 * suffix tells the API which app origin to return to.
 */
function getLoginNonce(): string {
  try {
    const existing = sessionStorage.getItem(LOGIN_NONCE_KEY);
    if (existing) return existing;
    const nonce = `${crypto.randomUUID()}.${encodeURIComponent(location.origin)}`;
    sessionStorage.setItem(LOGIN_NONCE_KEY, nonce);
    return nonce;
  } catch {
    return `${crypto.randomUUID()}.${encodeURIComponent(location.origin)}`;
  }
}

/** Reads and clears a sign-in result left in the URL by the redirect. */
export function consumeRedirectLogin(): { user: AuthUser } | { error: string } | null {
  if (typeof location === "undefined" || !location.hash) return null;

  const params = new URLSearchParams(location.hash.slice(1));
  const auth = params.get("auth");
  const authError = params.get("auth_error");
  if (!auth && !authError) return null;

  // Drop the session from the address bar and history.
  history.replaceState(null, "", location.pathname + location.search);

  if (authError) return { error: authError };

  try {
    const data = JSON.parse(auth!) as { token: string; user: AuthUser; nonce: string };
    let expected: string | null = null;
    try {
      expected = sessionStorage.getItem(LOGIN_NONCE_KEY);
      sessionStorage.removeItem(LOGIN_NONCE_KEY);
    } catch {
      // Storage blocked: the nonce can't be checked, so reject below.
    }
    if (!expected || data.nonce !== expected) return { error: "nonce_mismatch" };
    if (typeof data.token !== "string" || typeof data.user?.id !== "string") return { error: "invalid_response" };

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return { user: data.user };
  } catch {
    return { error: "invalid_response" };
  }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

// ─── Watchlist Sync ──────────────────────────────────────────────────────────

type WatchlistItem = {
  malId: number;
  [key: string]: unknown;
};

export async function fetchRemoteWatchlist(): Promise<{ items: WatchlistItem[]; updatedAt: string | null }> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) throw new Error("Please sign in again");

  const res = await fetch(`${API_BASE}/watchlist`, { headers });
  if (!res.ok) throw new Error("Unable to load cloud watchlist");

  const data = await res.json();
  return { items: (data.items || []) as WatchlistItem[], updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null };
}

/** Returns the server's save time, or null when the upload failed. */
export async function pushWatchlist(items: WatchlistItem[]): Promise<{ updatedAt: string | null } | null> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) return null;

  const res = await fetch(`${API_BASE}/watchlist`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ items }),
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return { updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null };
}

// The local revision counts user edits to the watchlist on this device. The sync
// state records which revision and server save time were last in agreement, so
// login can tell which side changed instead of always merging (which brought
// deleted items back).

export type SyncState = { userId: string; syncedAt: string | null; syncedRevision: number };
export type LoginSyncStrategy = "remote" | "local" | "merge";

export function getLocalRevision(): number {
  try {
    return Number(localStorage.getItem(REVISION_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function bumpLocalRevision(): void {
  try {
    localStorage.setItem(REVISION_KEY, String(getLocalRevision() + 1));
  } catch {
    // Without storage every login falls back to merging, which loses nothing.
  }
}

export function readSyncState(): SyncState | null {
  try {
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.userId === "string" && typeof parsed.syncedRevision === "number" ? (parsed as SyncState) : null;
  } catch {
    return null;
  }
}

export function writeSyncState(state: SyncState): void {
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  } catch {
    // See bumpLocalRevision.
  }
}

export function resolveLoginSync(state: SyncState | null, userId: string, localRevision: number, remoteUpdatedAt: string | null): LoginSyncStrategy {
  // This device never synced with this account: keep everything from both sides.
  if (!state || state.userId !== userId) return "merge";
  // No edits here since the last sync, so the server copy is current.
  if (localRevision === state.syncedRevision) return "remote";
  // Only this device changed since the last sync.
  if (remoteUpdatedAt !== null && remoteUpdatedAt === state.syncedAt) return "local";
  // Both sides changed: merge rather than drop either set of additions.
  return "merge";
}
