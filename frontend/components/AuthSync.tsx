'use client';

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const GLOBAL_LOGOUT_MARKER = "ra_global_logout_at";
const SESSION_UPDATE_MARKER = "ra_session_updated_at";

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

export default function AuthSync() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledAuthEventRef = useRef(false);

  useEffect(() => {
    const shouldProtectPage = isAdminPath(pathname);
    const authEvent = searchParams.get("auth_event");

    if (authEvent && !handledAuthEventRef.current) {
      handledAuthEventRef.current = true;

      if (authEvent === "session-updated") {
        try {
          localStorage.setItem(SESSION_UPDATE_MARKER, String(Date.now()));
        } catch {
          // ignore storage failures
        }
        window.dispatchEvent(new Event("gauth:session-updated"));

        const cleanedParams = new URLSearchParams(searchParams.toString());
        cleanedParams.delete("auth_event");
        const nextUrl = cleanedParams.toString() ? `${pathname}?${cleanedParams.toString()}` : pathname;
        router.replace(nextUrl);
        if (shouldProtectPage) {
          router.refresh();
        }
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === GLOBAL_LOGOUT_MARKER && event.newValue) {
        window.dispatchEvent(new Event("gauth:global-logout"));
        if (shouldProtectPage) {
          router.replace("/login?reason=session_logged_out");
        }
        return;
      }

      if (event.key === SESSION_UPDATE_MARKER && event.newValue) {
        window.dispatchEvent(new Event("gauth:session-updated"));
        if (shouldProtectPage) {
          router.refresh();
        }
      }
    };

    const handleGlobalLogout = () => {
      if (shouldProtectPage) {
        router.replace("/login?reason=session_logged_out");
      }
    };

    const handleAuthInvalid = () => {
      if (shouldProtectPage) {
        router.replace("/login?error=session_invalidated");
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("gauth:global-logout", handleGlobalLogout as EventListener);
    window.addEventListener("gauth:auth-invalid", handleAuthInvalid as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("gauth:global-logout", handleGlobalLogout as EventListener);
      window.removeEventListener("gauth:auth-invalid", handleAuthInvalid as EventListener);
    };
  }, [pathname, router, searchParams]);

  return null;
}