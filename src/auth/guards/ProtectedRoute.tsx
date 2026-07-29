import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { SessionLoading } from "@/auth/guards/SessionLoading";

export function ProtectedRoute() {
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
          from: `${location.pathname}${location.search}`,
          reason: auth.status === "error" ? "session-error" : "authentication-required",
        }}
      />
    );
  }

  return <Outlet />;
}
