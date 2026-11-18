// Minimal HS256 JWT for guest booking-engine sessions.
// Do NOT confuse with Supabase auth tokens — these are opaque to Supabase and
// only accepted by the booking-engine-public function.

const SECRET = Deno.env.get("GUEST_SESSION_SECRET") ?? "";

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = 4 - (s.length % 4);
  const b64 = (s + (pad < 4 ? "=".repeat(pad) : "")).replaceAll("-", "+").replaceAll("_", "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey> {
  if (!SECRET) throw new Error("GUEST_SESSION_SECRET not configured");
  return await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface GuestClaims {
  reservation_id: string;
  property_id: string;
  guest_id: string;
  iat: number;
  exp: number;
}

export async function signGuestToken(
  claims: Omit<GuestClaims, "iat" | "exp">,
  ttlSeconds = 60 * 60 * 2,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: GuestClaims = { ...claims, iat: now, exp: now + ttlSeconds };
  const header = { alg: "HS256", typ: "JWT" };
  const h = b64url(enc.encode(JSON.stringify(header)));
  const p = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(`${h}.${p}`)));
  return `${h}.${p}.${b64url(sig)}`;
}

export async function verifyGuestToken(token: string): Promise<GuestClaims | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const valid = await crypto.subtle.verify(
      "HMAC",
      await key(),
      b64urlDecode(s),
      enc.encode(`${h}.${p}`),
    );
    if (!valid) return null;
    const claims = JSON.parse(dec.decode(b64urlDecode(p))) as GuestClaims;
    if (!claims.exp || Math.floor(Date.now() / 1000) >= claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
