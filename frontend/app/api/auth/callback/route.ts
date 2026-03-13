import { NextResponse } from 'next/server';
import { createSessionToken, verifySignedToken } from '@/lib/session';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    // The backend drives the full OIDC flow and redirects here with the signed
    // session JWT as a query parameter after a successful exchange.
    const token = searchParams.get('token');

    const fail = (reason: string) =>
        NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, request.url));

    if (!token) return fail('missing_token');

    // Verify the backend-issued HMAC-SHA256 JWT (same AUTH_SECRET on both sides).
    const claims = await verifySignedToken<{
        sub: string;
        username: string;
        accountId: string;
        exp: number;
    }>(token);
    if (!claims) return fail('invalid_token');

    // Build the frontend session; accessToken = backend JWT used as Bearer in proxy requests.
    const sessionPayload = {
        sub: claims.sub,
        username: claims.username,
        accountId: claims.accountId,
        exp: claims.exp,
        accessToken: token,
    };
    const sessionToken = await createSessionToken(sessionPayload);
    const maxAge = Math.max(0, claims.exp - Math.floor(Date.now() / 1000));

    const response = NextResponse.redirect(new URL('/admin', request.url));
    response.cookies.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
    });
    return response;
}
