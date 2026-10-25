// Verifies Google ID tokens locally against Google's published signing keys,
// instead of calling the rate-limited tokeninfo debugging endpoint.
import { decodeBytes, decodeJson } from "./base64url";

const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const CLOCK_SKEW_SECONDS = 60;

export type GoogleIdClaims = {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type KeyCache = { keys: Map<string, CryptoKey>; expiresAt: number };

// Cached per isolate; refreshed when Cache-Control expires or an unknown key id appears.
let keyCache: KeyCache | null = null;

async function fetchKeys(): Promise<KeyCache> {
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`google_certs_${res.status}`);

  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("Cache-Control") || "")?.[1] ?? 3600);
  const { keys } = (await res.json()) as { keys: Array<JsonWebKey & { kid: string }> };
  const imported = new Map<string, CryptoKey>();

  for (const jwk of keys) {
    imported.set(jwk.kid, await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
  }

  return { keys: imported, expiresAt: Date.now() + maxAge * 1000 };
}

async function getKey(kid: string): Promise<CryptoKey | undefined> {
  if (!keyCache || keyCache.expiresAt < Date.now() || !keyCache.keys.has(kid)) {
    keyCache = await fetchKeys();
  }
  return keyCache.keys.get(kid);
}

export async function verifyGoogleIdToken(token: string, clientId: string): Promise<GoogleIdClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
    if (header.alg !== "RS256" || !header.kid) return null;

    const key = await getKey(header.kid);
    if (!key) return null;

    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;

    const claims = decodeJson<GoogleIdClaims>(parts[1]);
    const now = Math.floor(Date.now() / 1000);

    if (!ISSUERS.has(claims.iss) || claims.aud !== clientId || !claims.sub) return null;
    if (!claims.exp || claims.exp + CLOCK_SKEW_SECONDS < now) return null;

    return claims;
  } catch {
    return null;
  }
}
