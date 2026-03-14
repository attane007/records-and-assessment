import { NextResponse, NextRequest } from 'next/server';
import {
  forceRefreshSessionAccessToken,
  getSessionFromRequest,
  updateSessionToken,
  type SessionPayload,
} from '@/lib/session';

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');

const strippedResponseHeaderNames = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

type SessionWithAccessToken = SessionPayload & { accessToken: string };

function hasAccessToken(session: SessionPayload | null): session is SessionWithAccessToken {
  return typeof session?.accessToken === 'string' && session.accessToken.length > 0;
}

function buildProxyResponseHeaders(source: Headers) {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!strippedResponseHeaderNames.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

async function proxyFetch(path: string, init?: RequestInit) {
  const url = `${backendUrl}${path}`;
  const res = await fetch(url, init);

  // For non-OK responses, mirror status and body
  const headers = buildProxyResponseHeaders(res.headers);

  const body = await res.arrayBuffer();
  return new NextResponse(Buffer.from(body), { status: res.status, headers });
}

function buildAuthorizationHeader(tokenType: string | undefined, accessToken: string) {
  const normalizedType = tokenType && tokenType.trim() ? tokenType : 'Bearer';
  return `${normalizedType} ${accessToken}`;
}

async function proxyWithRetryOnUnauthorized(
  path: string,
  session: SessionWithAccessToken,
  init: RequestInit
) {
  let response = await proxyFetch(path, init);
  let currentSession = session;

  if (response.status === 401 && currentSession?.accessToken) {
    const refreshedSession = await forceRefreshSessionAccessToken(currentSession);
    if (hasAccessToken(refreshedSession)) {
      currentSession = refreshedSession;
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set('Authorization', buildAuthorizationHeader(currentSession.tokenType, currentSession.accessToken));
      response = await proxyFetch(path, {
        ...init,
        headers: retryHeaders,
      });
    }
  }

  return { response, session: currentSession };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!hasAccessToken(session)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const authorization = buildAuthorizationHeader(session.tokenType, session.accessToken);

    const url = new URL(req.url);
    const path = `/api/requests${url.search}`;
    // Forward cookies and auth headers
    const init: RequestInit = {
      method: 'GET',
      headers: {
        cookie: req.headers.get('cookie') || '',
        'x-forwarded-host': req.headers.get('host') || '',
        Authorization: authorization,
      },
      // no store so we always fetch fresh
      cache: 'no-store',
    };

    const { response, session: currentSession } = await proxyWithRetryOnUnauthorized(path, session, init);
    
    // Persist refreshed session token back to cookie
    const sessionToken = await updateSessionToken(currentSession);
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(0, currentSession.exp - Math.floor(Date.now() / 1000)),
    });
    
    return response;
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!hasAccessToken(session)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const authorization = buildAuthorizationHeader(session.tokenType, session.accessToken);

    const url = new URL(req.url);
    // Forward the full pathname (including /api) so the backend receives the same path
    const forwardPath = url.pathname + url.search;

    const body = await req.arrayBuffer();

    const init: RequestInit = {
      method: 'PUT',
      headers: {
        'content-type': req.headers.get('content-type') || 'application/json',
        cookie: req.headers.get('cookie') || '',
        Authorization: authorization,
      },
      body: Buffer.from(body),
    };

    const { response, session: currentSession } = await proxyWithRetryOnUnauthorized(forwardPath, session, init);

    const sessionToken = await updateSessionToken(currentSession);
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(0, currentSession.exp - Math.floor(Date.now() / 1000)),
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}

// Support other methods like POST if needed
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!hasAccessToken(session)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const authorization = buildAuthorizationHeader(session.tokenType, session.accessToken);

    const url = new URL(req.url);
    const forwardPath = url.pathname + url.search;
    const body = await req.arrayBuffer();

    const init: RequestInit = {
      method: 'POST',
      headers: {
        'content-type': req.headers.get('content-type') || 'application/json',
        cookie: req.headers.get('cookie') || '',
        Authorization: authorization,
      },
      body: Buffer.from(body),
    };

    const { response, session: currentSession } = await proxyWithRetryOnUnauthorized(forwardPath, session, init);

    const sessionToken = await updateSessionToken(currentSession);
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(0, currentSession.exp - Math.floor(Date.now() / 1000)),
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}
