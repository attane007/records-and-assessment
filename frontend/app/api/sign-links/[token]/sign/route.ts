import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/proxy";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const body = await req.arrayBuffer();
  
  return proxyToBackend(req, `/api/sign-links/${encodeURIComponent(token)}/sign`, {
    method: "POST",
    body: Buffer.from(body),
  });
}
