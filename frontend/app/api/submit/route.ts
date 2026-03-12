import { NextResponse } from "next/server";

export async function POST(req: Request) {
  void req;
  return NextResponse.json(
    { error: "endpoint deprecated, use /api/form-links/{token}/submit" },
    { status: 410 }
  );
}
