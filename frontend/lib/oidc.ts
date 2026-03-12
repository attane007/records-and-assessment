const AUTHORIZATION_PATH = '/auth/oauth/authorize';
const TOKEN_PATH = '/auth/oauth/token';
const PROFILE_PATH = '/auth/profile';

type OidcEndpoints = {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  profileEndpoint: string;
};

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

export function getOidcEndpoints(): OidcEndpoints | null {
  const baseUrl = process.env.OIDC_BASE_URL?.trim();

  if (!baseUrl) {
    return null;
  }

  const normalizedBaseUrl = trimTrailingSlashes(baseUrl);

  return {
    authorizationEndpoint: `${normalizedBaseUrl}${AUTHORIZATION_PATH}`,
    tokenEndpoint: `${normalizedBaseUrl}${TOKEN_PATH}`,
    profileEndpoint: `${normalizedBaseUrl}${PROFILE_PATH}`,
  };
}