// Lightweight HMAC-SHA256 signed token helpers for server components and API routes
// Token shape: base64url(header).base64url(payload).base64url(signature)
// header: { alg: "HS256", typ: "JWT" }

import { cookies } from "next/headers";
import { createHmac } from "crypto";

export type SessionPayload = {
  sub: string;
  username: string;
  exp: number; // unix seconds
};

const enc = new TextEncoder();

function base64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? enc.encode(input) : input;
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlToBytes(b64url: string) {
  const pad = 4 - (b64url.length % 4);
  const padded = b64url + (pad < 4 ? "=".repeat(pad) : "");
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "dev-secret-change-me";
  return enc.encode(secret);
}

function hmacSHA256(message: string, secret: Uint8Array) {
  const buf = createHmac("sha256", Buffer.from(secret)).update(message).digest();
  return new Uint8Array(buf);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = hmacSHA256(data, getSecret());
  return `${data}.${base64url(sig)}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const data = `${h}.${p}`;
    const expected = hmacSHA256(data, getSecret());
    const provided = b64urlToBytes(s);
    if (expected.length !== provided.length) return null;
    // constant-time compare
    let ok = 0;
    for (let i = 0; i < expected.length; i++) ok |= expected[i] ^ provided[i];
    if (ok !== 0) return null;
    const payload = JSON.parse(Buffer.from(b64urlToBytes(p)).toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || Date.now() / 1000 >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  // In server components and actions, cookies() can be async; await to satisfy types.
  // Reading only; setting should be done in Route Handlers via NextResponse.cookies.
  // @ts-ignore: cookies() may be typed sync/async depending on context; await works in both.
  const jar = await cookies();
  const token = jar?.get?.("session")?.value as string | undefined;
  if (!token) return null;
  return verifySessionToken(token);
}

export function getSessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const token = cookieHeader
    .split(/;\s*/)
    .map((p) => p.split("="))
    .find(([k]) => k === "session")?.[1];
  if (!token) return Promise.resolve(null);
  return verifySessionToken(decodeURIComponent(token));
}
