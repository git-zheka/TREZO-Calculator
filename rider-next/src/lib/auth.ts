/**
 * Найпростіша авторизація, яка тримається на одному паролі з env.
 * Cookie містить `<expiry>.<hmac>` — підпис перевіряється на Edge через Web Crypto,
 * тому працює і в middleware, і в route handler без жодної бібліотеки.
 */

export const COOKIE = "rider_session";
const MAX_AGE = 60 * 60 * 24 * 180; // пів року

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET не заданий. Див. .env.example");
  return s;
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function issueToken() {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifyToken(token: string | undefined | null) {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = await hmac(exp);
  // Порівняння сталого часу — довжини однакові, тож простий XOR-цикл підходить
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(input: string) {
  const real = process.env.APP_PASSWORD;
  if (!real) throw new Error("APP_PASSWORD не заданий. Див. .env.example");
  if (input.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= input.charCodeAt(i) ^ real.charCodeAt(i);
  return diff === 0;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};
