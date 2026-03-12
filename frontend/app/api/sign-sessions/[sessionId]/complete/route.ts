import { NextResponse, NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    const accountId = session?.accountId || '';

    const { sessionId } = await context.params;
    const body = await req.arrayBuffer();
    const res = await fetch(`${backendUrl}/api/sign-sessions/${encodeURIComponent(sessionId)}/complete`, {
      method: "POST",
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
        cookie: req.headers.get("cookie") || "",
        "X-Account-ID": accountId,
      },
      body: Buffer.from(body),
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": contentType } });
  } catch {
    return NextResponse.json({ error: "proxy error" }, { status: 500 });
  }
}
