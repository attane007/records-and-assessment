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

type OidcTokenRefreshResponse = {
  access_token: string;
  token_type?: string;
  refresh_token?: string;
  expires_in?: number;
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

export async function refreshAccessToken(
  refreshToken: string,
  tokenEndpoint: string,
  clientId: string,
  clientSecret?: string
): Promise<OidcTokenRefreshResponse | null> {
  try {
    const tokenBody = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const headers: HeadersInit = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (clientSecret) {
      headers["Authorization"] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
    }

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers,
      body: tokenBody.toString(),
    });

    if (!response.ok) {
      console.error("Token refresh failed", { status: response.statusText });
      return null;
    }

    const data = (await response.json()) as OidcTokenRefreshResponse;
    return data;
  } catch (error) {
    console.error("Token refresh exception", error);
    return null;
  }
}

/**
 * Parse JWT claims without validation (for refresh check)
 */
function parseJwtClaimsUnsafe(token: string): Partial<SessionPayload> | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const padding = 4 - (payloadB64.length % 4);
    const padded = payloadB64 + (padding < 4 ? "=".repeat(padding) : "");
    const payload = JSON.parse(Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return payload as Partial<SessionPayload>;
  } catch {
    return null;
  }
}

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

  // First, try normal verification
  let session = await verifySessionToken(decodedToken);

  // If normal verification failed, try to extract claims and check if expired
  if (!session) {
    session = parseJwtClaimsUnsafe(decodedToken) as SessionPayload | null;
    if (!session || typeof session.exp !== "number") return null;

    // Token is expired, attempt refresh if refresh token exists
    if (!session.refreshToken) return null; // Can't refresh without refresh token
  }

  // At this point, session is valid or we have the claims
  const refreshToken = session.refreshToken;
  if (!refreshToken) return session; // No refresh token, return as-is

  // Check if token expires within threshold or is already expired
  const now = Math.floor(Date.now() / 1000);
  const timeUntilExpiry = session.exp - now;
  const shouldRefresh = timeUntilExpiry <= REFRESH_TOKEN_THRESHOLD_SECONDS;

  if (!shouldRefresh) {
    // Token still valid for a while
    return session;
  }

  // Token expiring soon or already expired, attempt refresh
  const clientId = process.env.OIDC_CLIENT_ID || "";
  const clientSecret = process.env.OIDC_CLIENT_SECRET;

  try {
    const { getOidcEndpoints } = await import("@/lib/oidc");
    const endpoints = await getOidcEndpoints();

    if (!endpoints?.tokenEndpoint) {
      console.warn("OIDC endpoints not available for token refresh");
      return session && timeUntilExpiry > 0 ? session : null;
    }

    const refreshResult = await refreshAccessToken(
      refreshToken,
      endpoints.tokenEndpoint,
      clientId,
      clientSecret
    );

    if (!refreshResult) {
      // Refresh failed, return existing session only if still valid
      return session && timeUntilExpiry > 0 ? session : null;
    }

    // Update session with new tokens
    const newExp = Math.floor(Date.now() / 1000) + (refreshResult.expires_in || 3600);
    const updatedSession: SessionPayload = {
      ...session,
      accessToken: refreshResult.access_token,
      exp: newExp,
      ...(refreshResult.token_type ? { tokenType: refreshResult.token_type } : {}),
      ...(refreshResult.refresh_token ? { refreshToken: refreshResult.refresh_token } : {}),
    };

    return updatedSession;
  } catch (error) {
    console.error("Error during session refresh", error);
    return session && timeUntilExpiry > 0 ? session : null;
  }
}
