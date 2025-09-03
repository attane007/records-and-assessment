import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
    return NextResponse.json({ authenticated: true, session });
  } catch (e) {
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
