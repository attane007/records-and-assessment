import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const url = new URL("/", req.url);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set("session", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "strict" });
  return res;
}
