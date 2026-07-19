import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue } from "@/auth/auth-context";
import type { AuthSession, AuthStatus, UserRole } from "@/auth/auth-types";
import { endSession, fetchSession } from "@/auth/session-api";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);

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

  const logout = useCallback(async () => {
    try {
      await endSession();
    } finally {
      setSession(null);
      setStatus("anonymous");
    }
  }, []);

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
