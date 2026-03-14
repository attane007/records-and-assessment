import { NextResponse } from 'next/server';
import { forceRefreshSessionAccessToken, getSessionFromRequest, updateSessionToken } from '@/lib/session';

const BACKEND_URL = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:8080'
).replace(/\/$/, '');

async function forward(req: Request, path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown) {
  const session = await getSessionFromRequest(req);
  if (!session?.accessToken) {
    return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }), session: null };
  }

  const url = `${BACKEND_URL}${path}`;
  const cookie = req.headers.get('cookie') || '';
  const host = req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || '';

  try {
    const requestWithSession = async (activeSession: typeof session) => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        Authorization: `${activeSession.tokenType || 'Bearer'} ${activeSession.accessToken}`,
      });
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

      return fetch(url, fetchOptions);
    };

    let currentSession = session;
    let res = await requestWithSession(currentSession);

    if (res.status === 401) {
      const refreshedSession = await forceRefreshSessionAccessToken(currentSession);
      if (refreshedSession?.accessToken) {
        currentSession = refreshedSession;
        res = await requestWithSession(currentSession);
      }
    }

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    // Use NextResponse.json to properly set content-type and body
    return { response: NextResponse.json(data, { status: res.status }), session: currentSession };
  } catch (err) {
    console.error('Error forwarding request to backend:', err);
    return { response: NextResponse.json({ error: 'Backend forwarding failed' }, { status: 502 }), session };
  }
}

export async function GET(req: Request) {
  // Forward GET /api/officials and include incoming headers
  const { response, session } = await forward(req, '/api/officials', 'GET');
  
  // Persist session cookie
  if (session) {
    const sessionToken = await updateSessionToken(session);
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
    });
  }
  
  return response;
}

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const { response, session } = await forward(req, '/api/officials', 'POST', body);
  
  // Persist session cookie
  if (session) {
    const sessionToken = await updateSessionToken(session);
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
    });
  }
  
  return response;
}

export async function PUT(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const { response, session } = await forward(req, '/api/officials', 'PUT', body);
  
  // Persist session cookie
  if (session) {
    const sessionToken = await updateSessionToken(session);
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
    });
  }
  
  return response;
}
