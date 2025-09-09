import { NextResponse } from "next/server";

async function handleLogout(req: Request) {
  try {
  // Use a relative redirect to avoid depending on the incoming Host header
  // (some proxies / containers forward a localhost host which causes redirects to localhost)
  const res = NextResponse.redirect("/", 303);
    const isProd = process.env.NODE_ENV === "production";
    // clear cookie by setting empty value and maxAge 0
    res.cookies.set("session", "", {
      httpOnly: true,
      path: "/",
      maxAge: 0,
      sameSite: "strict",
      secure: isProd,
    });
    return res;
  } catch (err) {
    // log so stacktrace appears in server logs
    console.error("Logout handler error:", err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handleLogout(req);
}

// allow GET requests (useful when hitting the route from a link)
export async function GET(req: Request) {
  return handleLogout(req);
}
