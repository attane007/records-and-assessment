import { NextResponse, NextRequest } from 'next/server';

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');

import { getSessionFromRequest, updateSessionToken } from '@/lib/session';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const url = `${backendUrl}/api/pdf/${encodeURIComponent(id)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        cookie: req.headers.get('cookie') || '',
        Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
      },
    });

    if (!res.ok) return NextResponse.json({ error: 'failed to generate pdf' }, { status: res.status });

    const array = await res.arrayBuffer();
    const headers = new Headers();
    res.headers.forEach((v, k) => headers.set(k, v));

    const response = new NextResponse(Buffer.from(array), { status: res.status, headers });
    
    // Persist session cookie
    const sessionToken = await updateSessionToken(session);
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'proxy error' }, { status: 500 });
  }
}
