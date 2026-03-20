import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/proxy";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await context.params;
  const body = await req.arrayBuffer();
  
  return proxyToBackend(req, `/api/requests/${encodeURIComponent(requestId)}/signature/student`, {
    method: "PUT",
    body: Buffer.from(body),
  });
}
