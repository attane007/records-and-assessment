import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const backendUrl = (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  const incomingUrl = new URL(request.url);
  const target = new URL(`${backendUrl}/auth/login`);
  target.search = incomingUrl.search;
  return NextResponse.redirect(target);
}

export async function POST() {
  return NextResponse.json({ error: "use GET /api/login to sign in" }, { status: 405 });
}
