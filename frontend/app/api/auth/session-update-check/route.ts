import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };
}

function backendBaseURL(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8080"
  ).replace(/\/$/, "");
}

interface BackendSessionResponse {
  authenticated?: boolean;
  user?: {
    session_version?: number;
    auth_subject?: string;
    account_id?: string;
  };
}

/**
 * Checks if the session has been updated on the backend (e.g., account changed)
 * Returns whether a refresh is needed
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req as unknown as Request);
    if (!session) {
      return NextResponse.json(
        { need_refresh: false, reason: "no_session" },
        { headers: noStoreHeaders() }
      );
    }

    if (!session.accessToken) {
      return NextResponse.json(
        { need_refresh: false, reason: "no_access_token" },
        { headers: noStoreHeaders() }
      );
    }

    try {
      const response = await fetch(`${backendBaseURL()}/auth/session`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json(
          { need_refresh: true, reason: "backend_error" },
          { headers: noStoreHeaders() }
        );
      }

      const backend = (await response.json().catch(() => null)) as BackendSessionResponse | null;
      if (!backend?.authenticated || !backend?.user) {
        return NextResponse.json(
          { need_refresh: false, reason: "not_authenticated" },
          { headers: noStoreHeaders() }
        );
      }

      const backendSessionVersion = backend.user?.session_version || 0;
      const localSessionVersion = session.sessionVersion || 0;

      // Check if session version has changed (indicates account switch or permission change)
      if (backendSessionVersion !== localSessionVersion) {
        return NextResponse.json(
          {
            need_refresh: true,
            reason: "session_version_mismatch",
            local_version: localSessionVersion,
            backend_version: backendSessionVersion,
          },
          { headers: noStoreHeaders() }
        );
      }

      // Check if account_id changed
      if (backend.user?.account_id && session.accountId && backend.user.account_id !== session.accountId) {
        return NextResponse.json(
          { need_refresh: true, reason: "account_changed" },
          { headers: noStoreHeaders() }
        );
      }

      return NextResponse.json(
        { need_refresh: false, reason: "session_valid" },
        { headers: noStoreHeaders() }
      );
    } catch (e) {
      console.error("Failed to check backend session:", e);
      return NextResponse.json(
        { need_refresh: false, reason: "backend_unreachable" },
        { headers: noStoreHeaders() }
      );
    }
  } catch {
    return NextResponse.json(
      { need_refresh: false, reason: "internal_error" },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
