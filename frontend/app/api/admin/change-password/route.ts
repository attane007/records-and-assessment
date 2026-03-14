import { NextResponse } from "next/server";
import { forceRefreshSessionAccessToken, getSessionFromRequest, updateSessionToken } from "@/lib/session";
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
    const session = await getSessionFromRequest(req);
    if (!session?.accessToken) {
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
    const backendURL = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
    const requestPayload = JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    });

    const requestWithSession = (activeSession: typeof session) =>
      fetch(`${backendURL}/api/admin/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `${activeSession.tokenType || "Bearer"} ${activeSession.accessToken}`,
        },
        body: requestPayload,
      });

    let currentSession = session;
    let response = await requestWithSession(currentSession);

    if (response.status === 401) {
      const refreshedSession = await forceRefreshSessionAccessToken(currentSession);
      if (refreshedSession?.accessToken) {
        currentSession = refreshedSession;
        response = await requestWithSession(currentSession);
      }
    }

    const data: unknown = await response.json().catch(() => null);

    // Persist session cookie
    const sessionToken = await updateSessionToken(currentSession);
    const responseObj = response.ok
      ? NextResponse.json({ message: "password changed successfully" })
      : NextResponse.json(
          { error: isApiErrorResponse(data) ? data.error : "failed to change password" },
          { status: response.status }
        );
    
    responseObj.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.max(0, currentSession.exp - Math.floor(Date.now() / 1000)),
    });

    return responseObj;
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
