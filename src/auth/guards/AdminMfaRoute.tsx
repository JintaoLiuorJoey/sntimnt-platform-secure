import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/auth/auth-context";

const ENROLLMENT_PATH = "/mfa/enroll";

export function AdminMfaRoute() {
  const auth = useAuth();
  const location = useLocation();
  const isEnrollmentPage = location.pathname === ENROLLMENT_PATH;
  const isAdmin = auth.hasRole("admin");
  const decision = auth.session?.adminMfaConfiguration;

  if (isAdmin && decision === "enrollment-required") {
    if (isEnrollmentPage) return <Outlet />;

    return (
      <Navigate
        replace
        to={ENROLLMENT_PATH}
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (isEnrollmentPage) {
    return (
      <Navigate
        replace
        to={isAdmin ? "/admin" : "/forbidden"}
        state={{ from: ENROLLMENT_PATH }}
      />
    );
  }

  return <Outlet />;
}
