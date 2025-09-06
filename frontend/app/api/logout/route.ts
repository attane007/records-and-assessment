import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Use a relative redirect so the browser redirects to the current origin
  // (avoids embedding an absolute host like localhost:3000 in the Location header)
  const res = NextResponse.redirect('/', 303);
  res.cookies.set("session", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "strict" });
  return res;
}
