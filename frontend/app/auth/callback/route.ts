import { NextResponse } from "next/server";

function resolveFrontendOrigin(request: Request): string {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();

  if (forwardedHost) {
    const proto = forwardedProto || "https";
    return `${proto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

function resolveBackendOrigin(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const frontendOrigin = resolveFrontendOrigin(request);
  const backendOrigin = resolveBackendOrigin();

  if (requestUrl.searchParams.has("error") || requestUrl.searchParams.has("code") || requestUrl.searchParams.has("state")) {
    return NextResponse.redirect(new URL(`/auth/callback${requestUrl.search}`, backendOrigin));
  }

  if (requestUrl.searchParams.has("token")) {
    return NextResponse.redirect(new URL(`/api/auth/callback${requestUrl.search}`, frontendOrigin));
  }

  return NextResponse.redirect(new URL("/login?error=missing_token", frontendOrigin));
}