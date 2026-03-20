import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/proxy";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const body = await req.arrayBuffer();
  
  return proxyToBackend(req, `/api/sign-sessions/${encodeURIComponent(sessionId)}/complete`, {
    method: "POST",
    body: Buffer.from(body),
  });
}
