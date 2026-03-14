import { NextResponse, NextRequest } from 'next/server';

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

import { forceRefreshSessionAccessToken, getSessionFromRequest, updateSessionToken } from '@/lib/session';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const url = `${backendUrl}/api/pdf/${encodeURIComponent(id)}`;

    const requestWithSession = (activeSession: typeof session) =>
      fetch(url, {
        method: 'GET',
        headers: {
          cookie: req.headers.get('cookie') || '',
          Authorization: `${activeSession.tokenType || 'Bearer'} ${activeSession.accessToken}`,
        },
      });

    let currentSession = session;
    let res = await requestWithSession(currentSession);

    if (res.status === 401) {
      const refreshedSession = await forceRefreshSessionAccessToken(currentSession);
      if (refreshedSession?.accessToken) {
        currentSession = refreshedSession;
        res = await requestWithSession(currentSession);
      }
    }

    if (!res.ok) return NextResponse.json({ error: 'failed to generate pdf' }, { status: res.status });

    const array = await res.arrayBuffer();
    const headers = buildProxyResponseHeaders(res.headers);

    const response = new NextResponse(Buffer.from(array), { status: res.status, headers });
    
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
