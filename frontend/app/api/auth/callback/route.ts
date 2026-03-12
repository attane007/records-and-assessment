import { NextResponse } from 'next/server';
import { createSessionToken } from '@/lib/session';
import { verifySignedToken } from '@/lib/session';
import { getOidcEndpoints } from '../../../../lib/oidc';

type OidcTransactionPayload = {
    state: string;
    nonce: string;
    codeVerifier: string;
    exp: number;
};

type OidcTokenResponse = {
    access_token?: string;
    token_type?: string;
    id_token?: string;
    expires_in?: number;
};

function getCookieValue(request: Request, cookieName: string) {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(/;\s*/);
    for (const entry of cookies) {
        const separatorIndex = entry.indexOf('=');
        if (separatorIndex < 0) continue;
        const name = entry.slice(0, separatorIndex);
        if (name !== cookieName) continue;
        return decodeURIComponent(entry.slice(separatorIndex + 1));
    }
    return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payloadB64Url = parts[1];
        if (!payloadB64Url) return null;
        const padding = 4 - (payloadB64Url.length % 4);
        const padded = payloadB64Url + (padding < 4 ? '='.repeat(padding) : '');
        const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
        const payloadJson = Buffer.from(b64, 'base64').toString('utf8');
        return JSON.parse(payloadJson) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    const fail = (reason: string) => {
        const response = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, request.url));
        response.cookies.set('oidc_tx', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0,
        });
        return response;
    };

    if (error) {
        console.error("OIDC Error:", error);
        return fail('auth_failed');
    }

    if (!code) {
        return fail('no_code');
    }

    if (!state) {
        return fail('missing_state');
    }

    const txToken = getCookieValue(request, 'oidc_tx');
    if (!txToken) {
        return fail('missing_state');
    }

    const tx = await verifySignedToken<OidcTransactionPayload>(txToken);
    if (!tx) {
        return fail('invalid_state');
    }
    if (tx.state !== state) {
        return fail('state_mismatch');
    }

    const clientId = process.env.OIDC_CLIENT_ID;
    const clientSecret = process.env.OIDC_CLIENT_SECRET;
    const oidcEndpoints = await getOidcEndpoints();

    if (!clientId || !oidcEndpoints) {
        console.error("Missing OIDC credentials in environment");
        return fail('config_error');
    }

    const redirectUri = `${new URL(request.url).origin}/api/auth/callback`;

    try {
        // 1. Exchange the code for an access token
        const tokenHeaders: HeadersInit = {
            'Content-Type': 'application/x-www-form-urlencoded',
        };
        if (clientSecret) {
            tokenHeaders['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
        }

        const tokenBody = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: tx.codeVerifier,
        });
        if (!clientSecret) {
            tokenBody.set('client_id', clientId);
        }

        const tokenResponse = await fetch(oidcEndpoints.tokenEndpoint, {
            method: 'POST',
            headers: tokenHeaders,
            body: tokenBody.toString(),
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error("Failed to exchange token:", errorText);
            return fail('token_exchange_failed');
        }

        const tokenData = (await tokenResponse.json()) as OidcTokenResponse;
        const accessToken = tokenData.access_token;
        if (!accessToken) {
            return fail('token_exchange_failed');
        }

        if (tokenData.id_token) {
            const idTokenPayload = decodeJwtPayload(tokenData.id_token);
            if (!idTokenPayload) {
                return fail('invalid_id_token');
            }
            const nonceClaim = idTokenPayload.nonce;
            if (typeof nonceClaim !== 'string' || nonceClaim !== tx.nonce) {
                return fail('nonce_mismatch');
            }
        }

        // 2. Fetch user profile using the access token
        const profileEndpoint = oidcEndpoints.userinfoEndpoint ?? oidcEndpoints.profileEndpoint;
        const profileResponse = await fetch(profileEndpoint, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!profileResponse.ok) {
            console.error("Failed to fetch profile");
            return fail('profile_fetch_failed');
        }

        const profileData = await profileResponse.json();

        // Some providers return profile fields at root, others wrap them in `{ user: { ... } }`.
        const profile = profileData?.user ?? profileData;

        // Map OIDC-compatible fields to account/session fields.
        const accountId = profile?.id ?? profile?.sub ?? profile?.account_id ?? profile?.accountId ?? profile?.email;
        const username = profile?.username ?? profile?.name ?? profile?.email ?? accountId;

        if (!accountId) {
            console.error("No recognizable ID field in profile:", profileData);
            return fail('invalid_profile');
        }

        // 3. Create local session
        const expiresIn = typeof tokenData.expires_in === 'number' && tokenData.expires_in > 0
            ? Math.floor(tokenData.expires_in)
            : 60 * 60;
        const exp = Math.floor(Date.now() / 1000) + expiresIn;
        const backendBearerToken = tokenData.id_token ?? accessToken;
        const sessionPayload = {
            sub: String(accountId),
            username: String(username),
            accountId: String(accountId),
            exp,
            accessToken: backendBearerToken,
            ...(tokenData.token_type ? { tokenType: tokenData.token_type } : {}),
        };
        const sessionToken = await createSessionToken(sessionPayload);

        // 4. Set session cookie and redirect to admin dashboard
        const response = NextResponse.redirect(new URL('/admin', request.url));
        response.cookies.set('session', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: expiresIn,
        });
        response.cookies.set('oidc_tx', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 0,
        });

        return response;
    } catch (error) {
        console.error("Auth callback exception:", error);
        return fail('auth_exception');
    }
}
