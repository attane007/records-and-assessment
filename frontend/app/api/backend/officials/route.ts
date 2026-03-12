import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

async function forward(req: Request, path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown) {
  const session = await getSessionFromRequest(req);
  const accountId = session?.accountId || '';

  const url = `${BACKEND_URL}${path}`;
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Account-ID': accountId,
  });

  const cookie = req.headers.get('cookie') || '';
  const host = req.headers.get('host') || '';
  if (cookie) headers.set('cookie', cookie);
  if (host) headers.set('x-forwarded-host', host);

  const fetchOptions: RequestInit = {
    method,
    headers,
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
