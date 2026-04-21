import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

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

function backendBaseURL(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

async function resolveLogoutURL(request: Request): Promise<string> {
  const frontendOrigin = resolveFrontendOrigin(request);
  const postLogoutRedirectURI = `${frontendOrigin}/login?reason=session_logged_out`;
  const session = await getSessionFromRequest(request);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  try {
    const response = await fetch(`${backendBaseURL()}/auth/logout`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        post_logout_redirect_uri: postLogoutRedirectURI,
      }),
      cache: "no-store",
    });
    if (!response.ok) return postLogoutRedirectURI;
    const data = (await response.json()) as { logout_url?: string };
    if (!data.logout_url) return postLogoutRedirectURI;
    return data.logout_url;
  } catch {
    return postLogoutRedirectURI;
  }
}

async function handleLogout(request: Request) {
  try {
    const logoutURL = await resolveLogoutURL(request);
    const isProd = process.env.NODE_ENV === "production";
    const cookie = `session=; Path=/; Max-Age=0; SameSite=Strict; HttpOnly${isProd ? "; Secure" : ""}`;
    const txCookie = `oidc_tx=; Path=/; Max-Age=0; SameSite=Strict; HttpOnly${isProd ? "; Secure" : ""}`;
    const headers = new Headers();
    headers.set("Location", logoutURL);
    headers.append("Set-Cookie", cookie);
    headers.append("Set-Cookie", txCookie);
    headers.set("Cache-Control", "no-store");
    headers.set("Pragma", "no-cache");

    return new Response(null, {
      status: 303,
      headers,
    });
  } catch (err) {
    // log so stacktrace appears in server logs
    console.error("Logout handler error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleLogout(request);
}

// allow GET requests (useful when hitting the route from a link)
export async function GET(request: Request) {
  return handleLogout(request);
}
