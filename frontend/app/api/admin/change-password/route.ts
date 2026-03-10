import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/session";
import type { ApiErrorResponse, ChangePasswordRequestBody } from "@/lib/types/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && typeof value.error === "string";
}

function isChangePasswordRequestBody(value: unknown): value is ChangePasswordRequestBody {
  if (!isRecord(value)) return false;
  return typeof value.currentPassword === "string" && typeof value.newPassword === "string";
}

export async function POST(req: Request) {
  try {
    // Check if user is authenticated
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => null);
    if (!isChangePasswordRequestBody(body)) {
      return NextResponse.json({ error: "current password and new password are required" }, { status: 400 });
    }

    const currentPassword = body.currentPassword;
    const newPassword = body.newPassword;
    
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

    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message = isApiErrorResponse(data) ? data.error : "failed to change password";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    return NextResponse.json({ message: "password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
