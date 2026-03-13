// Lightweight HMAC-SHA256 signed token helpers for server components and API routes
// Token shape: base64url(header).base64url(payload).base64url(signature)
// header: { alg: "HS256", typ: "JWT" }

import { cookies } from "next/headers";
import { createHmac } from "crypto";
import type { AdminSession } from "@/lib/types/api";

type SignedPayload = {
  exp: number;
};

export type SessionPayload = AdminSession & {
  accessToken?: string;
  tokenType?: string;
  refreshToken?: string;
};

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
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

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  if (typeof value !== "object" || value === null) return false;
  return "then" in value && typeof (value as { then?: unknown }).then === "function";
}

async function getCookieStore(): Promise<CookieStore> {
  const maybeStore = cookies() as unknown;
  if (isPromiseLike<CookieStore>(maybeStore)) {
    return await maybeStore;
  }
  return maybeStore as CookieStore;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return createSignedToken(payload);
}

export async function createSignedToken<T extends SignedPayload>(payload: T): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = hmacSHA256(data, getSecret());
  return `${data}.${base64url(sig)}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  return verifySignedToken<SessionPayload>(token);
}

export async function verifySignedToken<T extends SignedPayload>(token: string): Promise<T | null> {
  try {
    const [h, p, s] = token.split(".");
    if (!h || !p || !s) return null;
    const data = `${h}.${p}`;
    const expected = hmacSHA256(data, getSecret());
    const provided = b64urlToBytes(s);
    if (expected.length !== provided.length) return null;
    // constant-time compare
    let ok = 0;
    for (let i = 0; i < expected.length; i++) ok |= (expected[i] ?? 0) ^ (provided[i] ?? 0);
    if (ok !== 0) return null;
    const payload = JSON.parse(Buffer.from(b64urlToBytes(p)).toString("utf8")) as T;
    if (typeof payload.exp !== "number" || Date.now() / 1000 >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

const REFRESH_TOKEN_THRESHOLD_SECONDS = 5 * 60; // Refresh if less than 5 minutes remaining

export async function updateSessionToken(
  payload: SessionPayload,
  expiresIn?: number
): Promise<string> {
  const newPayload = {
    ...payload,
    exp: payload.exp || Math.floor(Date.now() / 1000) + (expiresIn || 3600),
  };
  return createSessionToken(newPayload);
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await getCookieStore();
  const token = jar.get("session")?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const token = cookieHeader
    .split(/;\s*/)
    .map((p) => p.split("="))
    .find(([k]) => k === "session")?.[1];
  if (!token) return Promise.resolve(null);

  const decodedToken = decodeURIComponent(token);

  let session = await verifySessionToken(decodedToken);
  if (!session) return null;

  // Proactively refresh the backend JWT when it is about to expire.
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = session.exp - now;
  if (timeUntilExpiry <= REFRESH_TOKEN_THRESHOLD_SECONDS && session.accessToken) {
    try {
      const refreshed = await refreshSessionFromBackend(session.accessToken);
      if (refreshed) {
        return { ...session, accessToken: refreshed.token, exp: now + refreshed.expires_in };
      }
    } catch {
      // Refresh failed — return the still-valid session as-is.
    }
  }
  return session;
}

async function refreshSessionFromBackend(
  accessToken: string
): Promise<{ token: string; expires_in: number } | null> {
  const backendUrl = (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(`${backendUrl}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: string; expires_in?: number };
    if (!data.token) return null;
    return { token: data.token, expires_in: data.expires_in ?? 28800 };
  } catch {
    return null;
  }
}
