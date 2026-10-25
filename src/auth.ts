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

export async function loginWithGoogle(credential: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "auth_failed" }));
    throw new Error(err.error || "auth_failed");
  }

  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
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
