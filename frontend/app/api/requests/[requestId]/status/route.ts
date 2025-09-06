import { NextResponse, NextRequest } from 'next/server';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');

async function proxyFetch(path: string, init?: RequestInit) {
  const url = `${backendUrl}${path}`;
  const res = await fetch(url, init);

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));

  const body = await res.arrayBuffer();
  return new NextResponse(Buffer.from(body), { status: res.status, headers });
}

export async function PUT(req: NextRequest) {
  try {
    const url = new URL(req.url);
    // forward full pathname (includes /api/requests/<id>/status) and query
    const forwardPath = url.pathname + url.search;

    const body = await req.arrayBuffer();

    const init: RequestInit = {
      method: 'PUT',
      headers: {
        'content-type': req.headers.get('content-type') || 'application/json',
        cookie: req.headers.get('cookie') || '',
        'x-forwarded-host': req.headers.get('host') || '',
      },
      body: Buffer.from(body),
    };

    return await proxyFetch(forwardPath, init);
  } catch (e) {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}

export async function GET() {
  // optional: respond with 405 to indicate only PUT is allowed for this route
  return NextResponse.json({ error: 'method not allowed' }, { status: 405 });
}
