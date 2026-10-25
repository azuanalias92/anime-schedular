// Byte-safe base64url helpers. btoa/atob alone only handle Latin-1, so text
// goes through TextEncoder/TextDecoder to support any Unicode name.

export function encodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function decodeBytes(segment: string): Uint8Array {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function encodeJson(value: unknown): string {
  return encodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

export function decodeJson<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBytes(segment))) as T;
}
