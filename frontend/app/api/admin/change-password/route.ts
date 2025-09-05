import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/session";

export async function POST(req: Request) {
  try {
    // Check if user is authenticated
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "current password and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "new password must be at least 6 characters long" }, { status: 400 });
    }

    // Send request to backend
    const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    const response = await fetch(`${backendURL}/api/admin/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-User": session.username || "admin",
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error || "failed to change password" }, { status: response.status });
    }

    return NextResponse.json({ message: "password changed successfully" });
  } catch (e) {
    console.error("Change password error:", e);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
