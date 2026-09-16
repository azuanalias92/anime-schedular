// JWT helpers for AniCount API
// Uses HMAC-SHA256 — same pattern as komuniti-kita

type TokenPayload = {
  sub: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
};

function base64url(str: string): string {
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function generateToken(
  payload: Record<string, unknown>,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + 86400 * 7 }; // 7 days

  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(tokenPayload))}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = base64url(String.fromCharCode(...new Uint8Array(sig)));

  return `${data}.${sigB64}`;
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<TokenPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const data = `${parts[0]}.${parts[1]}`;
    const sigB64 = parts[2].replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (sigB64.length % 4)) % 4);
    const signature = Uint8Array.from(atob(sigB64 + padding), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(data));
    if (!valid) return null;

    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);

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

export function extractToken(request: Request): string | null {
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}
