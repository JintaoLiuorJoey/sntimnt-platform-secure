import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/auth/auth-context";
import type { UserRole } from "@/auth/auth-types";
import { SessionLoading } from "@/auth/guards/SessionLoading";

interface RoleRouteProps {
  allowedRoles: readonly UserRole[];
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return <SessionLoading />;
  }

  if (!auth.isAuthenticated) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
          reason: auth.status === "error" ? "session-error" : "authentication-required",
        }}
      />
    );
  }

  const isAllowed = allowedRoles.some((role) => auth.hasRole(role));
  if (!isAllowed) {
    return (
      <Navigate
        to="/forbidden"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  return <Outlet />;
}
