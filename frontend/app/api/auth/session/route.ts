import { NextResponse } from "next/server";
import { getSessionFromRequest, updateSessionToken } from "@/lib/session";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200, headers: noStoreHeaders() });
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