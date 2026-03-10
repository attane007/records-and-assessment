import { NextResponse, NextRequest } from 'next/server';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');

async function proxyFetch(path: string, init?: RequestInit) {
    const url = `${backendUrl}${path}`;
    const res = await fetch(url, init);

    const headers = new Headers();
    res.headers.forEach((v, k) => headers.set(k, v));

    const body = await res.arrayBuffer();
    return new NextResponse(Buffer.from(body), { status: res.status, headers });
}

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const path = `/api/verify${url.search}`;
        const init: RequestInit = {
            method: 'GET',
            headers: {
                cookie: req.headers.get('cookie') || '',
                'x-forwarded-host': req.headers.get('host') || '',
            },
            cache: 'no-store',
        };

        return await proxyFetch(path, init);
    } catch {
        return NextResponse.json({ error: 'proxy error' }, { status: 500 });
    }
}
