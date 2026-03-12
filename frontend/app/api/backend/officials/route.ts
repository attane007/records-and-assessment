import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:8080'
).replace(/\/$/, '');

async function forward(req: Request, path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown) {
  const session = await getSessionFromRequest(req);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = `${BACKEND_URL}${path}`;
  const headers = new Headers({
    'Content-Type': 'application/json',
    Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
  });

  const cookie = req.headers.get('cookie') || '';
  const host = req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || '';
  if (cookie) headers.set('cookie', cookie);
  if (host) headers.set('x-forwarded-host', host);
  if (proto) headers.set('x-forwarded-proto', proto);

  const fetchOptions: RequestInit = {
    method,
    headers,
    cache: 'no-store',
  };
  if (body !== undefined && body !== null) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, fetchOptions);
    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
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
  return forward(req, '/api/officials', 'GET');
}

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  return forward(req, '/api/officials', 'POST', body);
}

export async function PUT(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  return forward(req, '/api/officials', 'PUT', body);
}
