import { NextResponse, NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');

async function proxyFetch(path: string, init?: RequestInit) {
  const url = `${backendUrl}${path}`;
  const res = await fetch(url, init);

  // For non-OK responses, mirror status and body
  const headers = new Headers();
  res.headers.forEach((v, k) => headers.set(k, v));

  const body = await res.arrayBuffer();
  return new NextResponse(Buffer.from(body), { status: res.status, headers });
}

function buildAuthorizationHeader(tokenType: string | undefined, accessToken: string) {
  const normalizedType = tokenType && tokenType.trim() ? tokenType : 'Bearer';
  return `${normalizedType} ${accessToken}`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.accessToken) {
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

    return await proxyFetch(path, init);
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.accessToken) {
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

    return await proxyFetch(forwardPath, init);
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}

// Support other methods like POST if needed
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.accessToken) {
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

    return await proxyFetch(forwardPath, init);
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}
