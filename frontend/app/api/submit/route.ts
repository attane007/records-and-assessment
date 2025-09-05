import { NextResponse } from 'next/server';

// Server-side proxy to backend. Use BACKEND_URL if provided, otherwise fall back to NEXT_PUBLIC_BACKEND_URL
const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8080').replace(/\/$/, '');

export async function POST(req: Request) {
  try {
    const url = `${backendUrl}/api/submit`;

    // forward body as JSON
    const body = await req.json();

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || 'application/json';

    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return new NextResponse(JSON.stringify({ error: 'proxy error', detail: msg }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}
