import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

async function forward(path: string, method: string, body?: any, incomingHeaders?: Headers) {
  const url = `${BACKEND_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (incomingHeaders) {
    const cookie = incomingHeaders.get?.('cookie') || '';
    const host = incomingHeaders.get?.('host') || '';
    if (cookie) headers['cookie'] = cookie;
    if (host) headers['x-forwarded-host'] = host;
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  try {
    const res = await fetch(url, fetchOptions);
    const text = await res.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }

    // Use NextResponse.json to properly set content-type and body
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error('Error forwarding request to backend:', err);
    return NextResponse.json({ error: 'Backend forwarding failed' }, { status: 502 });
  }
}

export async function GET(req: Request) {
  // Forward GET /api/officials and include incoming headers
  return forward('/api/officials', 'GET', undefined, req.headers as Headers);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return forward('/api/officials', 'POST', body, req.headers as Headers);
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  return forward('/api/officials', 'PUT', body, req.headers as Headers);
}
