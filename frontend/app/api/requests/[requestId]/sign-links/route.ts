import { NextResponse, NextRequest } from "next/server";
import { getSessionFromRequest, updateSessionToken } from "@/lib/session";

const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { requestId } = await context.params;
    const body = await req.arrayBuffer();
    const host = req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || "http";

    const res = await fetch(`${backendUrl}/api/requests/${encodeURIComponent(requestId)}/sign-links`, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
        cookie: req.headers.get("cookie") || "",
        "x-forwarded-host": host,
        "x-forwarded-proto": proto,
        Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
      },
      body: Buffer.from(body),
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    const response = new NextResponse(text, { status: res.status, headers: { "Content-Type": contentType } });
    
    // Persist refreshed session token back to cookie
    const sessionToken = await updateSessionToken(session);
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
    });
    
    return response;
  } catch {
    return NextResponse.json({ error: "proxy error" }, { status: 500 });
  }
}
