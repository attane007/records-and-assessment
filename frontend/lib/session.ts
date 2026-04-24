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
  accessTokenExp?: number;
};

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

const enc = new TextEncoder();
const REFRESH_TOKEN_THRESHOLD_SECONDS = 5 * 60;
const DEFAULT_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

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

function getVerificationSecrets(): Uint8Array[] {
  const candidates = [process.env.AUTH_SECRET || "dev-secret-change-me", process.env.AUTH_SECRET_PREVIOUS || ""];
  const secrets: Uint8Array[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    secrets.push(enc.encode(trimmed));
  }

  return secrets;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function getSessionMaxAgeSeconds(): number {
  return parsePositiveInt(process.env.SESSION_MAX_AGE_SECONDS) ?? DEFAULT_SESSION_MAX_AGE_SECONDS;
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
    const provided = b64urlToBytes(s);

    for (const secret of getVerificationSecrets()) {
      const expected = hmacSHA256(data, secret);
      if (expected.length !== provided.length) {
        continue;
      }

      // constant-time compare
      let ok = 0;
      for (let i = 0; i < expected.length; i++) ok |= (expected[i] ?? 0) ^ (provided[i] ?? 0);
      if (ok === 0) {
        const payload = JSON.parse(Buffer.from(b64urlToBytes(p)).toString("utf8")) as T;
        if (typeof payload.exp !== "number" || Date.now() / 1000 >= payload.exp) return null;
        return payload;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function getAccessTokenExp(payload: SessionPayload): number {
  return typeof payload.accessTokenExp === "number" ? payload.accessTokenExp : payload.exp;
}

async function ensureFreshAccessToken(
  payload: SessionPayload,
  forceRefresh = false
): Promise<SessionPayload | null> {
  if (!payload.accessToken) return payload;

  const now = Math.floor(Date.now() / 1000);
  const accessTokenExp = getAccessTokenExp(payload);
  const timeUntilExpiry = accessTokenExp - now;

  if (!forceRefresh && timeUntilExpiry > REFRESH_TOKEN_THRESHOLD_SECONDS) {
    return payload;
  }

  const refreshed = await refreshSessionFromBackend(payload.accessToken);
  if (refreshed) {
    const refreshedExp =
      typeof refreshed.exp === "number" ? refreshed.exp : now + refreshed.expires_in;
    return {
      ...payload,
      accessToken: refreshed.token,
      accessTokenExp: refreshedExp,
    };
  }

  if (forceRefresh || timeUntilExpiry <= 0) {
    return null;
  }

  return payload;
}

export async function forceRefreshSessionAccessToken(
  payload: SessionPayload
): Promise<SessionPayload | null> {
  return ensureFreshAccessToken(payload, true);
}

function resolveBackendURL(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

async function validateSessionWithBackend(accessToken: string): Promise<boolean | null> {
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(`${resolveBackendURL()}/auth/session`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return false;
    }

    const payload = (await response.json().catch(() => null)) as { authenticated?: boolean } | null;
    return payload?.authenticated === true;
  } catch {
    return null;
  }
}

export async function updateSessionToken(
  payload: SessionPayload,
  expiresIn?: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const sessionExp = payload.exp > now ? payload.exp : now + getSessionMaxAgeSeconds();
  const nextAccessTokenExp = payload.accessToken
    ? typeof expiresIn === "number" && expiresIn > 0
      ? now + expiresIn
      : getAccessTokenExp(payload)
    : undefined;

  const newPayload: SessionPayload = {
    ...payload,
    exp: sessionExp,
  };
  if (typeof nextAccessTokenExp === "number") {
    newPayload.accessTokenExp = nextAccessTokenExp;
  }
  return createSessionToken(newPayload);
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const jar = await getCookieStore();
  const token = jar.get("session")?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const freshSession = await ensureFreshAccessToken(session);
  if (!freshSession) {
    return null;
  }

  const backendStatus = freshSession.accessToken ? await validateSessionWithBackend(freshSession.accessToken) : null;
  if (backendStatus === false) {
    return null;
  }

  return freshSession;
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

  session = await ensureFreshAccessToken(session);
  if (!session) return null;
  return session;
}

async function refreshSessionFromBackend(
  accessToken: string
): Promise<{ token: string; expires_in: number; exp?: number } | null> {
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
    const data = (await response.json()) as { token?: string; expires_in?: number; exp?: number };
    if (!data.token) return null;
    const normalizedExp = typeof data.exp === "number" ? data.exp : null;
    if (normalizedExp !== null) {
      return {
        token: data.token,
        expires_in: data.expires_in ?? 28800,
        exp: normalizedExp,
      };
    }
    return {
      token: data.token,
      expires_in: data.expires_in ?? 28800,
    };
  } catch {
    return null;
  }
}
