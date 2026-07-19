import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "@/auth/auth-context";
import type { AuthSession, AuthStatus, UserRole } from "@/auth/auth-types";
import { buildLoginPagePath, safeInternalReturnTo } from "@/auth/auth-navigation";
import { endSession, fetchSession } from "@/auth/session-api";
import { subscribeToSessionExpired } from "@/auth/session-events";

interface AuthProviderProps {
  children: ReactNode;
}

const MAX_TIMER_DELAY_MS = 2_147_483_647;

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

  const currentReturnTo = safeInternalReturnTo(
    `${location.pathname}${location.search}${location.hash}`,
  );

  const clearExpiredSession = useCallback(() => {
    setSession(null);
    setStatus("anonymous");
    navigate(buildLoginPagePath(currentReturnTo, "session-expired"), { replace: true });
  }, [currentReturnTo, navigate]);

  const refreshSession = useCallback(async () => {
    setStatus("loading");

    try {
      const nextSession = await fetchSession();
      setSession(nextSession);
      setStatus(nextSession ? "authenticated" : "anonymous");
    } catch {
      // Authentication failures must never fall back to a locally trusted user.
      setSession(null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadInitialSession = async () => {
      try {
        const nextSession = await fetchSession(controller.signal);
        setSession(nextSession);
        setStatus(nextSession ? "authenticated" : "anonymous");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSession(null);
        setStatus("error");
      }
    };

    void loadInitialSession();
    return () => controller.abort();
  }, []);

  useEffect(() => subscribeToSessionExpired(clearExpiredSession), [clearExpiredSession]);

  useEffect(() => {
    if (status !== "authenticated" || !session) return;

    let timerId: number | undefined;
    let cancelled = false;

    const checkExpiry = () => {
      if (cancelled) return;

      const remainingMs = Date.parse(session.expiresAt) - Date.now();
      if (remainingMs <= 0) {
        clearExpiredSession();
        return;
      }

      timerId = window.setTimeout(checkExpiry, Math.min(remainingMs, MAX_TIMER_DELAY_MS));
    };

    checkExpiry();
    return () => {
      cancelled = true;
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, [clearExpiredSession, session, status]);

  const logout = useCallback(async () => {
    let logoutCompleted = false;

    try {
      await endSession();
      logoutCompleted = true;
    } finally {
      setSession(null);
      setStatus("anonymous");
      navigate(
        buildLoginPagePath(
          "/dashboard",
          logoutCompleted ? "logged-out" : "logout-incomplete",
        ),
        { replace: true },
      );
    }
  }, [navigate]);

  const value = useMemo<AuthContextValue>(() => {
    const hasRole = (role: UserRole) => session?.user.roles.includes(role) ?? false;

    return {
      status,
      session,
      user: session?.user ?? null,
      isAuthenticated: status === "authenticated" && session !== null,
      hasRole,
      refreshSession,
      logout,
    };
  }, [logout, refreshSession, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
