import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

async function forward(path: string, method: string, body?: any, headers?: Headers) {
  const url = `${BACKEND_URL}${path}`;
  const fetchOptions: RequestInit = {
    method,
    headers: {
      // Forward JSON content-type by default; callers can override
      'Content-Type': 'application/json',
    },
    // We forward the body if present
    body: body ? JSON.stringify(body) : undefined,
  };

  try {
    const res = await fetch(url, fetchOptions);
    const text = await res.text();
    // Try to parse JSON, otherwise return text
    let data: any;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }

    return new NextResponse(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error forwarding request to backend:', err);
    return new NextResponse(JSON.stringify({ error: 'Backend forwarding failed' }), { status: 502 });
  }
}

export async function GET() {
  // Forward GET /api/officials
  return forward('/api/officials', 'GET');
}

export async function POST(req: Request) {
  // Forward POST (create/update) to backend
  const body = await req.json().catch(() => null);
  return forward('/api/officials', 'POST', body);
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  return forward('/api/officials', 'PUT', body);
}
