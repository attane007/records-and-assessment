import { NextResponse } from "next/server";

async function handleLogout(req: Request) {
  try {
    // Build a response that sets a relative Location header and clears the session cookie.
    // Using NextResponse.redirect with a relative path can throw in some runtimes,
    // so construct the headers manually to avoid URL validation issues and to avoid
    // relying on an incoming Host header that may be set to localhost by proxies.
    const isProd = process.env.NODE_ENV === "production";
    const cookie = `session=; Path=/; Max-Age=0; SameSite=Strict; HttpOnly${isProd ? "; Secure" : ""}`;

    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": cookie,
      },
    });
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
