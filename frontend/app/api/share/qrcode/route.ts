import { NextResponse, NextRequest } from 'next/server';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return NextResponse.json({ error: 'missing url parameter' }, { status: 400 });
    }

    const backendPath = `/api/share/qrcode?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(`${backendUrl}${backendPath}`, {
        cache: 'no-store'
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      return NextResponse.json(errorBody, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    const body = await res.arrayBuffer();

    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('QR code proxy error:', error);
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}
