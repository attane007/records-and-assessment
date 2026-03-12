import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { createSignedToken } from '@/lib/session';
import { getOidcEndpoints } from '../../../../lib/oidc';

type OidcTransactionPayload = {
    state: string;
    nonce: string;
    codeVerifier: string;
    exp: number;
};

function randomBase64Url(bytes: number) {
    return randomBytes(bytes).toString('base64url');
}

export async function GET(request: Request) {
    const clientId = process.env.OIDC_CLIENT_ID;
    const oidcEndpoints = await getOidcEndpoints();

    if (!clientId || !oidcEndpoints) {
        console.error("Missing OIDC auth configuration in environment");
        return NextResponse.json({ error: "OIDC Configuration Error" }, { status: 500 });
    }

    const redirectUri = `${new URL(request.url).origin}/api/auth/callback`;

    const state = randomBase64Url(32);
    const nonce = randomBase64Url(32);
    const codeVerifier = randomBase64Url(64);
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const txPayload: OidcTransactionPayload = {
        state,
        nonce,
        codeVerifier,
        exp: Math.floor(Date.now() / 1000) + 60 * 10,
    };

    const txToken = await createSignedToken(txPayload);

    // Standard OIDC authorization endpoint parameters
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'openid profile email', // Requesting standard scopes
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });

    const authorizationUrl = `${oidcEndpoints.authorizationEndpoint}?${params.toString()}`;

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set('oidc_tx', txToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 10,
    });

    return response;
}
