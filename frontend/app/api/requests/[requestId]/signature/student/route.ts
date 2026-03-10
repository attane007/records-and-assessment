import { NextResponse, NextRequest } from "next/server";

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await context.params;
    const body = await req.arrayBuffer();
    const res = await fetch(`${backendUrl}/api/requests/${encodeURIComponent(requestId)}/signature/student`, {
      method: "PUT",
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
        cookie: req.headers.get("cookie") || "",
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
