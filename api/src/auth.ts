// JWT helpers for AniCount API
// Uses HMAC-SHA256 — same pattern as komuniti-kita
import { decodeBytes, decodeJson, encodeBytes, encodeJson } from "./base64url";

type TokenPayload = {
  sub: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
};

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function generateToken(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + 86400 * 7 }; // 7 days

  const data = `${encodeJson(header)}.${encodeJson(tokenPayload)}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), new TextEncoder().encode(data));

  return `${data}.${encodeBytes(new Uint8Array(sig))}`;
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const data = `${parts[0]}.${parts[1]}`;
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), decodeBytes(parts[2]), new TextEncoder().encode(data));
    if (!valid) return null;

    const payload = decodeJson<TokenPayload>(parts[1]);

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;

    return {
      sub: payload.sub || "",
      email: payload.email || "",
      name: payload.name || "",
    };
  } catch {
    return null;
  }
}

export function extractToken(header: string | undefined): string | null {
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}
