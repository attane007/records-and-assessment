import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

const backendUrl = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8080"
).replace(/\/$/, "");

/**
 * Proxies a request to the backend with proper headers,
 * including X-Forwarded-For to preserve the client's IP.
 */
export async function proxyToBackend(
  req: NextRequest,
  path: string,
  options: {
    method?: string;
    body?: BodyInit;
    contentType?: string;
  } = {}
) {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get("x-forwarded-for");
    
    const backendHeaders: Record<string, string> = {
      "content-type": options.contentType || req.headers.get("content-type") || "application/json",
      "cookie": req.headers.get("cookie") || "",
    };

    // Forward the client's IP address
    if (forwardedFor) {
      backendHeaders["X-Forwarded-For"] = forwardedFor;
    }

    const res = await fetch(`${backendUrl}${path}`, {
      method: options.method || req.method,
      headers: backendHeaders,
      body: options.body ?? null,
    });

    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    console.error(`Proxy error for ${path}:`, error);
    return NextResponse.json({ error: "proxy error" }, { status: 500 });
  }
}
