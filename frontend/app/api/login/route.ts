import { NextResponse } from "next/server";

const legacyLoginResponse = {
  error: "legacy_login_disabled",
  message: "Use /api/auth/oidc to start sign-in.",
  loginUrl: "/api/auth/oidc",
};

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/api/auth/oidc", request.url));
}

export async function POST() {
  return NextResponse.json(legacyLoginResponse, { status: 410 });
}
