import { NextResponse } from 'next/server';
import { getOidcEndpoints } from '../../../../lib/oidc';

export async function GET(request: Request) {
    const clientId = process.env.OIDC_CLIENT_ID;
    const oidcEndpoints = getOidcEndpoints();

    if (!clientId || !oidcEndpoints) {
        console.error("Missing OIDC auth configuration in environment");
        return NextResponse.json({ error: "OIDC Configuration Error" }, { status: 500 });
    }

    // Use the host from the request to build the redirect URI dynamically
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/auth/callback`;

    // Standard OIDC authorization endpoint parameters
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'openid profile email', // Requesting standard scopes
        // In a real production app, state should be generated, stored in a cookie, and verified in the callback
        state: Math.random().toString(36).substring(7),
    });

    const authorizationUrl = `${oidcEndpoints.authorizationEndpoint}?${params.toString()}`;

    // Redirect the user to the OIDC provider's login page
    return NextResponse.redirect(authorizationUrl);
}
