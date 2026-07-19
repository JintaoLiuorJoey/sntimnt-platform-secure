import { createContext, useContext } from "react";
import type { AuthSession, AuthStatus, AuthenticatedUser, UserRole } from "@/auth/auth-types";

export interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
