import { NextResponse } from 'next/server';
import { createSessionToken, verifySignedToken } from '@/lib/session';

const DEFAULT_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function resolveSessionMaxAgeSeconds(): number {
    const raw = process.env.SESSION_MAX_AGE_SECONDS;
    if (!raw) return DEFAULT_SESSION_MAX_AGE_SECONDS;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SESSION_MAX_AGE_SECONDS;
    return parsed;
}

function resolveFrontendOrigin(request: Request): string {
    const configured = process.env.FRONTEND_URL?.trim();
    if (configured) {
        return configured.replace(/\/$/, '');
    }

    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost =
        request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
        request.headers.get('host')?.trim();

    if (forwardedHost) {
        const proto = forwardedProto || 'https';
        return `${proto}://${forwardedHost}`;
    }

    return new URL(request.url).origin;
}

export async function GET(request: Request) {
    const frontendOrigin = resolveFrontendOrigin(request);
    const { searchParams } = new URL(request.url);
    // The backend drives the full OIDC flow and redirects here with the signed
    // session JWT as a query parameter after a successful exchange.
    const token = searchParams.get('token');

    const fail = (reason: string) =>
        NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, frontendOrigin));

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
    const now = Math.floor(Date.now() / 1000);
    const sessionMaxAge = resolveSessionMaxAgeSeconds();
    const sessionExp = now + sessionMaxAge;
    const sessionPayload = {
        sub: claims.sub,
        username: claims.username,
        accountId: claims.accountId,
        exp: sessionExp,
        accessToken: token,
        accessTokenExp: claims.exp,
    };
    const sessionToken = await createSessionToken(sessionPayload);
    const maxAge = Math.max(0, sessionExp - now);

    const response = NextResponse.redirect(new URL('/admin', frontendOrigin));
    response.cookies.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
    });
    return response;
}
