'use client';

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const GLOBAL_LOGOUT_MARKER = "ra_global_logout_at";
const SESSION_UPDATE_MARKER = "ra_session_updated_at";
const SILENT_SYNC_LAST_ATTEMPT_KEY = "ra_admin_silent_sync_last_attempt_at";
const LAST_REFRESH_TIME_KEY = "ra_last_refresh_time_at";
const LAST_SESSION_VERSION_KEY = "ra_last_session_version";
const SILENT_SYNC_COOLDOWN_MS = 30 * 1000;
const SILENT_SYNC_MIN_HIDDEN_MS = 5 * 1000;
const REFRESH_DEBOUNCE_MS = 2 * 1000;
const SESSION_CHECK_INTERVAL_MS = 30 * 1000; // Check for account changes every 30 seconds

function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin");
}

export default function AuthSync() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledAuthEventRef = useRef(false);
  const hiddenAtRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  const debounceRefresh = (reason: string) => {
    if (isRefreshingRef.current) {
      return;
    }

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      try {
        const now = Date.now();
        const lastRefreshRaw = window.localStorage.getItem(LAST_REFRESH_TIME_KEY);
        const lastRefresh = Number.parseInt(lastRefreshRaw || "0", 10);
        
        // Prevent refreshes within REFRESH_DEBOUNCE_MS
        if (Number.isFinite(lastRefresh) && now - lastRefresh < REFRESH_DEBOUNCE_MS) {
          return;
        }

        isRefreshingRef.current = true;
        window.localStorage.setItem(LAST_REFRESH_TIME_KEY, String(now));
        router.refresh();
      } catch {
        // ignore errors
      } finally {
        isRefreshingRef.current = false;
        refreshTimeoutRef.current = null;
      }
    }, REFRESH_DEBOUNCE_MS);
  };

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  // Periodic check for account/session changes (backchannel session events)
  useEffect(() => {
    const shouldProtectPage = isAdminPath(pathname);
    if (!shouldProtectPage) {
      return;
    }

    const checkSessionUpdates = async () => {
      try {
        const response = await fetch("/api/auth/session-update-check", {
          cache: "no-store",
          headers: { "Accept": "application/json" },
        });
        
        if (!response.ok) {
          return;
        }

        const data = (await response.json().catch(() => null)) as {
          need_refresh?: boolean;
          reason?: string;
        } | null;

        if (data?.need_refresh) {
          debounceRefresh("session_update_check");
        }
      } catch {
        // Silently ignore errors in session check
      }
    };

    const intervalId = setInterval(checkSessionUpdates, SESSION_CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [pathname]);

  useEffect(() => {
    const shouldProtectPage = isAdminPath(pathname);
    const authEvent = searchParams.get("auth_event");
    const returnTo = (() => {
      const cleanedParams = new URLSearchParams(searchParams.toString());
      cleanedParams.delete("auth_event");
      const query = cleanedParams.toString();
      return query ? `${pathname}?${query}` : pathname;
    })();

    const attemptSilentSessionSync = () => {
      if (!shouldProtectPage || authEvent) {
        return;
      }

      try {
        const now = Date.now();
        const lastAttemptRaw = window.localStorage.getItem(SILENT_SYNC_LAST_ATTEMPT_KEY);
        const lastAttempt = Number.parseInt(lastAttemptRaw || "0", 10);
        const cooldownActive = Number.isFinite(lastAttempt) && now - lastAttempt < SILENT_SYNC_COOLDOWN_MS;
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
        } catch {
          // ignore storage failures
        }
        window.dispatchEvent(new Event("gauth:session-updated"));

        const cleanedParams = new URLSearchParams(searchParams.toString());
        cleanedParams.delete("auth_event");
        const nextUrl = cleanedParams.toString() ? `${pathname}?${cleanedParams.toString()}` : pathname;
        router.replace(nextUrl);
        if (shouldProtectPage) {
          debounceRefresh("auth_event");
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
          debounceRefresh("storage_marker");
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
    window.addEventListener("gauth:global-logout", handleAuthInvalid as EventListener);
    window.addEventListener("gauth:auth-invalid", handleAuthInvalid as EventListener);
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("gauth:global-logout", handleAuthInvalid as EventListener);
      window.removeEventListener("gauth:auth-invalid", handleAuthInvalid as EventListener);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, router, searchParams]);

  return null;
}