const AUTHORIZATION_PATH = "/auth/oauth/authorize";
const TOKEN_PATH = "/auth/oauth/token";
const PROFILE_PATH = "/auth/profile";
const DISCOVERY_PATH = "/.well-known/openid-configuration";
const DISCOVERY_CACHE_TTL_MS = 5 * 60 * 1000;

export type OidcEndpoints = {
  issuer?: string;
  discoveryUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri?: string;
  userinfoEndpoint?: string;
  profileEndpoint: string;
};

type OidcDiscoveryDocument = {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
};

let cachedOidcEndpoints: { value: OidcEndpoints; expiresAt: number } | null = null;

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, "");
}

function getDiscoveryUrl(): string | null {
  const explicitDiscovery = process.env.OIDC_DISCOVERY_URL?.trim();
  if (explicitDiscovery) {
    return explicitDiscovery;
  }

  const baseUrl = process.env.OIDC_BASE_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  return `${trimTrailingSlashes(baseUrl)}${DISCOVERY_PATH}`;
}

function buildFallbackEndpoints(baseUrl: string | null, discoveryUrl: string | null): OidcEndpoints | null {
  if (!baseUrl || !discoveryUrl) {
    return null;
  }

  const normalizedBaseUrl = trimTrailingSlashes(baseUrl);
  return {
    discoveryUrl,
    authorizationEndpoint: `${normalizedBaseUrl}${AUTHORIZATION_PATH}`,
    tokenEndpoint: `${normalizedBaseUrl}${TOKEN_PATH}`,
    userinfoEndpoint: `${normalizedBaseUrl}${PROFILE_PATH}`,
    profileEndpoint: `${normalizedBaseUrl}${PROFILE_PATH}`,
  };
}

export async function getOidcEndpoints(): Promise<OidcEndpoints | null> {
  if (cachedOidcEndpoints && cachedOidcEndpoints.expiresAt > Date.now()) {
    return cachedOidcEndpoints.value;
  }

  const discoveryUrl = getDiscoveryUrl();
  const baseUrl = process.env.OIDC_BASE_URL?.trim() ?? null;
  const fallback = buildFallbackEndpoints(baseUrl, discoveryUrl);
  if (!discoveryUrl) {
    return fallback;
  }

  try {
    const response = await fetch(discoveryUrl, { cache: "no-store" });
    if (!response.ok) {
      console.error("OIDC discovery failed", { status: response.status, discoveryUrl });
      return fallback;
    }

    const document = (await response.json()) as OidcDiscoveryDocument;
    const authorizationEndpoint = document.authorization_endpoint ?? fallback?.authorizationEndpoint;
    const tokenEndpoint = document.token_endpoint ?? fallback?.tokenEndpoint;
    const userinfoEndpoint = document.userinfo_endpoint ?? fallback?.userinfoEndpoint;
    const profileEndpoint = userinfoEndpoint ?? fallback?.profileEndpoint;

    if (!authorizationEndpoint || !tokenEndpoint || !profileEndpoint) {
      console.error("OIDC discovery document is missing required endpoints", { discoveryUrl });
      return fallback;
    }

    const resolved: OidcEndpoints = {
      discoveryUrl,
      authorizationEndpoint,
      tokenEndpoint,
      profileEndpoint,
      ...(document.issuer ? { issuer: document.issuer } : {}),
      ...(document.jwks_uri ? { jwksUri: document.jwks_uri } : {}),
      ...(userinfoEndpoint ? { userinfoEndpoint } : {}),
    };

    cachedOidcEndpoints = {
      value: resolved,
      expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS,
    };

    return resolved;
  } catch (error) {
    console.error("OIDC discovery request failed", error);
    return fallback;
  }
}