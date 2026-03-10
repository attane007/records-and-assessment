import { NextResponse, NextRequest } from "next/server";

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const res = await fetch(`${backendUrl}/api/sign-sessions/${encodeURIComponent(sessionId)}/status`, {
      method: "GET",
      headers: {
        cookie: req.headers.get("cookie") || "",
      },
      cache: "no-store",
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": contentType } });
  } catch {
    return NextResponse.json({ error: "proxy error" }, { status: 500 });
  }
}
