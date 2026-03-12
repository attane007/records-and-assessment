import { NextResponse } from "next/server";
import { getSessionFromRequest, updateSessionToken } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
    const { accessToken: _accessToken, tokenType: _tokenType, ...publicSession } = session;
    const response = NextResponse.json({ authenticated: true, session: publicSession });
    
    // Persist session cookie
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
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
