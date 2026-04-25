import { NextRequest, NextResponse } from "next/server";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };
}

export async function GET(req: NextRequest) {
  void req;
  return NextResponse.json(
    { need_refresh: false, reason: "sync_disabled" },
    { headers: noStoreHeaders() }
  );
}
