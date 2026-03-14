import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
  return NextResponse.redirect(`${backendUrl}/auth/login`);
}

export async function POST() {
  return NextResponse.json({ error: "use GET /api/login to sign in" }, { status: 405 });
}
