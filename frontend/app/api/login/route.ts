import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    
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
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
