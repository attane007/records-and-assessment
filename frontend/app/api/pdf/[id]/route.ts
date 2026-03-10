import { NextResponse, NextRequest } from 'next/server';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = `${backendUrl}/api/pdf/${encodeURIComponent(id)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        cookie: req.headers.get('cookie') || '',
      },
    });

    if (!res.ok) return NextResponse.json({ error: 'failed to generate pdf' }, { status: res.status });

    const array = await res.arrayBuffer();
    const headers = new Headers();
    res.headers.forEach((v, k) => headers.set(k, v));

    return new NextResponse(Buffer.from(array), { status: res.status, headers });
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}
