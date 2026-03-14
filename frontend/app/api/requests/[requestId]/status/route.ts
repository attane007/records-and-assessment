import { NextResponse, NextRequest } from 'next/server';
import { forceRefreshSessionAccessToken, getSessionFromRequest, updateSessionToken } from '@/lib/session';

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

  const headers = buildProxyResponseHeaders(res.headers);

  const body = await res.arrayBuffer();
  return new NextResponse(Buffer.from(body), { status: res.status, headers });
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    // forward full pathname (includes /api/requests/<id>/status) and query
    const forwardPath = url.pathname + url.search;

    const body = await req.arrayBuffer();

    const requestWithSession = (activeSession: typeof session) =>
      proxyFetch(forwardPath, {
        method: 'PUT',
        headers: {
          'content-type': req.headers.get('content-type') || 'application/json',
          cookie: req.headers.get('cookie') || '',
          'x-forwarded-host': req.headers.get('host') || '',
          Authorization: `${activeSession.tokenType || 'Bearer'} ${activeSession.accessToken}`,
        },
        body: Buffer.from(body),
      });

    let currentSession = session;
    let response = await requestWithSession(currentSession);

    if (response.status === 401) {
      const refreshedSession = await forceRefreshSessionAccessToken(currentSession);
      if (refreshedSession?.accessToken) {
        currentSession = refreshedSession;
        response = await requestWithSession(currentSession);
      }
    }
    
    // Persist session cookie
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

export async function GET() {
  // optional: respond with 405 to indicate only PUT is allowed for this route
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 });
}
