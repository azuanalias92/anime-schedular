const API_BASE = "https://anicount-api.traone.workers.dev";
const TOKEN_KEY = "anicount-auth-token";
const USER_KEY = "anicount-auth-user";

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
  return atob(b64);
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

export async function fetchRemoteWatchlist(): Promise<WatchlistItem[]> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) return [];

  const res = await fetch(`${API_BASE}/watchlist`, { headers });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.items || []) as WatchlistItem[];
}

export async function pushWatchlist(items: WatchlistItem[]): Promise<boolean> {
  const headers = getAuthHeaders();
  if (!headers.Authorization) return false;

  const res = await fetch(`${API_BASE}/watchlist`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ items }),
  });

  return res.ok;
}
