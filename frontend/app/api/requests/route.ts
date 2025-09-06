import { NextResponse, NextRequest } from 'next/server';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');
async function proxyFetch(path: string, init?: RequestInit) {
  const url = `${backendUrl}${path}`;
  const res = await fetch(url, init);

  // For non-OK responses, mirror status and body
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));

  const body = await res.arrayBuffer();
  return new NextResponse(Buffer.from(body), { status: res.status, headers });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = `/api/requests${url.search}`;
    // Forward cookies and auth headers
    const init: RequestInit = {
      method: 'GET',
      headers: {
        cookie: req.headers.get('cookie') || '',
        // allow the backend to see the original host if needed
        'x-forwarded-host': req.headers.get('host') || '',
      },
      // no store so we always fetch fresh
      cache: 'no-store',
    };

    return await proxyFetch(path, init);
  } catch (e) {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // Expect path like /api/requests/{id}/status - the path after /api
    const forwardPath = url.pathname.replace('/api', '') + url.search;

    const body = await req.arrayBuffer();

    const init: RequestInit = {
      method: 'PUT',
      headers: {
        'content-type': req.headers.get('content-type') || 'application/json',
        cookie: req.headers.get('cookie') || '',
      },
      body: Buffer.from(body),
    };

    return await proxyFetch(forwardPath, init);
  } catch (e) {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}

// Support other methods like POST if needed
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const forwardPath = url.pathname.replace('/api', '') + url.search;
    const body = await req.arrayBuffer();

    const init: RequestInit = {
      method: 'POST',
      headers: {
        'content-type': req.headers.get('content-type') || 'application/json',
        cookie: req.headers.get('cookie') || '',
      },
      body: Buffer.from(body),
    };

    return await proxyFetch(forwardPath, init);
  } catch (e) {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}
