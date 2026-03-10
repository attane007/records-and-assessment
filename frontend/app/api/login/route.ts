import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/session";
import type { LoginRequestBody } from "@/lib/types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLoginRequestBody(value: unknown): value is LoginRequestBody {
  if (!isRecord(value)) return false;
  return typeof value.username === "string" && typeof value.password === "string";
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!isLoginRequestBody(body)) {
      return NextResponse.json({ error: "missing credentials" }, { status: 400 });
    }

    const username = body.username.trim();
    const password = body.password;
    
    if (!username || !password) {
      return NextResponse.json({ error: "missing credentials" }, { status: 400 });
    }

    // Check credentials against backend
    const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const authResponse = await fetch(`${backendURL}/api/admin/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!authResponse.ok) {
      return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8h
    const token = await createSessionToken({ sub: "admin", username, exp });
    const res = NextResponse.json({ ok: true });
    const isProd = process.env.NODE_ENV === "production";
    res.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: isProd,
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
