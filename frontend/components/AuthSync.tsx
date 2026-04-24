'use client';

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const GLOBAL_LOGOUT_MARKER = "ra_global_logout_at";
const SESSION_UPDATE_MARKER = "ra_session_updated_at";
const SILENT_SYNC_LAST_ATTEMPT_KEY = "ra_admin_silent_sync_last_attempt_at";
const SILENT_SYNC_FAST_LANE_UNTIL_KEY = "ra_admin_silent_sync_fast_lane_until";
const SILENT_SYNC_COOLDOWN_MS = 30 * 1000;
const SILENT_SYNC_MIN_HIDDEN_MS = 5 * 1000;
const SILENT_SYNC_FAST_LANE_WINDOW_MS = 15 * 1000;

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

export default function AuthSync() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledAuthEventRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    const shouldProtectPage = isAdminPath(pathname);
    const authEvent = searchParams.get("auth_event");
    const returnTo = (() => {
      const cleanedParams = new URLSearchParams(searchParams.toString());
      cleanedParams.delete("auth_event");
      const query = cleanedParams.toString();
      return query ? `${pathname}?${query}` : pathname;
    })();

    const consumeFastLaneBypass = () => {
      try {
        const now = Date.now();
        const fastLaneUntilRaw = window.sessionStorage.getItem(SILENT_SYNC_FAST_LANE_UNTIL_KEY);
        const fastLaneUntil = Number.parseInt(fastLaneUntilRaw || "0", 10);
        if (!Number.isFinite(fastLaneUntil) || fastLaneUntil <= now) {
          return false;
        }

        window.sessionStorage.removeItem(SILENT_SYNC_FAST_LANE_UNTIL_KEY);
        return true;
      } catch {
        return false;
      }
    };

    const attemptSilentSessionSync = (ignoreCooldown = false) => {
      if (!shouldProtectPage || authEvent) {
        return;
      }

      try {
        const now = Date.now();
        const lastAttemptRaw = window.localStorage.getItem(SILENT_SYNC_LAST_ATTEMPT_KEY);
        const lastAttempt = Number.parseInt(lastAttemptRaw || "0", 10);
        const bypassCooldown = ignoreCooldown || consumeFastLaneBypass();
        const cooldownActive = !bypassCooldown && Number.isFinite(lastAttempt) && now - lastAttempt < SILENT_SYNC_COOLDOWN_MS;
        if (cooldownActive) {
          return;
        }

        window.localStorage.setItem(SILENT_SYNC_LAST_ATTEMPT_KEY, String(now));
        window.location.replace(`/api/login?prompt=none&return_to=${encodeURIComponent(returnTo)}`);
      } catch {
        // ignore storage/navigation failures
      }
    };

    if (authEvent && !handledAuthEventRef.current) {
      handledAuthEventRef.current = true;

      if (authEvent === "session-updated") {
        try {
          localStorage.setItem(SESSION_UPDATE_MARKER, String(Date.now()));
          sessionStorage.setItem(
            SILENT_SYNC_FAST_LANE_UNTIL_KEY,
            String(Date.now() + SILENT_SYNC_FAST_LANE_WINDOW_MS),
          );
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

    attemptSilentSessionSync();

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

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }

      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt !== null && Date.now() - hiddenAt >= SILENT_SYNC_MIN_HIDDEN_MS) {
        attemptSilentSessionSync();
      }
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === "visible") {
        attemptSilentSessionSync();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("gauth:global-logout", handleGlobalLogout as EventListener);
    window.addEventListener("gauth:auth-invalid", handleAuthInvalid as EventListener);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("gauth:global-logout", handleGlobalLogout as EventListener);
      window.removeEventListener("gauth:auth-invalid", handleAuthInvalid as EventListener);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, router, searchParams]);

  return null;
}