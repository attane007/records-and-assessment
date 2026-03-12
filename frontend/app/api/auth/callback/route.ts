import { NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/session';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        console.error("OIDC Error:", error);
        return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL('/login?error=no_code', request.url));
    }

    const clientId = process.env.OIDC_CLIENT_ID;
    const clientSecret = process.env.OIDC_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("Missing OIDC credentials in environment");
        return NextResponse.redirect(new URL('/login?error=config_error', request.url));
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/auth/callback`;
    const TOKEN_ENDPOINT = 'https://auth.krufame.work/auth/oauth/token';
    const PROFILE_ENDPOINT = 'https://auth.krufame.work/auth/profile';

    try {
        // 1. Exchange the code for an access token
        const tokenResponse = await fetch(TOKEN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            }).toString(),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("Failed to exchange token:", errorText);
            return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url));
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 2. Fetch user profile using the access token
        const profileResponse = await fetch(PROFILE_ENDPOINT, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!profileResponse.ok) {
            console.error("Failed to fetch profile");
            return NextResponse.redirect(new URL('/login?error=profile_fetch_failed', request.url));
        }

        const profileData = await profileResponse.json();

        // Krufame Auth Profile usually returns `{ id, email, username, name }` or similar.
        // We will use standard fields. Map OIDC `id` or `sub` to AccountID.
        const accountId = profileData.id || profileData.sub || profileData.email;
        const username = profileData.username || profileData.name || profileData.email;

        if (!accountId) {
            console.error("No recognizable ID field in profile:", profileData);
            return NextResponse.redirect(new URL('/login?error=invalid_profile', request.url));
        }

        // 3. Create local session
        // Expires in 24 hours
        const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
        const sessionToken = await createSessionToken({
            sub: String(accountId),
            username: String(username),
            accountId: String(accountId), // Map account ID for multi-tenant isolation
            exp,
        });

        // 4. Set session cookie and redirect to admin dashboard
        const response = NextResponse.redirect(new URL('/admin', request.url));
        response.cookies.set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24, // 1 day
        });

        return response;
    } catch (error) {
        console.error("Auth callback exception:", error);
        return NextResponse.redirect(new URL('/login?error=auth_exception', request.url));
    }
}
