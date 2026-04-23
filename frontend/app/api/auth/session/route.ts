import { NextResponse } from "next/server";
import { getSessionFromRequest, updateSessionToken } from "@/lib/session";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };
}

function backendBaseURL(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

async function validateSessionWithBackend(accessToken: string): Promise<boolean | null> {
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(`${backendBaseURL()}/auth/session`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return false;
    }

    const payload = (await response.json().catch(() => null)) as { authenticated?: boolean } | null;
    return payload?.authenticated === true;
  } catch {
    return null;
  }
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200, headers: noStoreHeaders() });
    }

    const backendStatus = session.accessToken ? await validateSessionWithBackend(session.accessToken) : null;
    if (backendStatus === false) {
      const response = NextResponse.json({ authenticated: false }, { status: 200, headers: noStoreHeaders() });
      clearSessionCookie(response);
      return response;
    }

    const { accessToken: _accessToken, tokenType: _tokenType, refreshToken: _refreshToken, accessTokenExp: _accessTokenExp, ...publicSession } = session;
    const response = NextResponse.json({ authenticated: true, session: publicSession }, { status: 200 });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Pragma", "no-cache");

    const sessionToken = await updateSessionToken(session);
    response.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
    });

    return response;
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 500, headers: noStoreHeaders() });
  }
}