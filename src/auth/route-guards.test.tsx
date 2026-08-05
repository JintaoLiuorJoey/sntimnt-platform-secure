import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/auth/auth-context";
import type { AuthSession, AuthStatus, UserRole } from "@/auth/auth-types";
import { ProtectedRoute } from "@/auth/guards/ProtectedRoute";
import { RoleRoute } from "@/auth/guards/RoleRoute";

const baseSession: AuthSession = {
  user: {
    id: "usr-test-001",
    email: "investor@example.invalid",
    displayName: "Test Investor",
    roles: ["investor"],
  },
  expiresAt: "2030-01-01T00:00:00.000Z",
};

function authValue(status: AuthStatus, roles: UserRole[] = []): AuthContextValue {
  const session =
    status === "authenticated"
      ? {
          ...baseSession,
          user: { ...baseSession.user, roles },
        }
      : null;

  return {
    status,
    session,
    user: session?.user ?? null,
    isAuthenticated: status === "authenticated" && session !== null,
    hasRole: (role) => session?.user.roles.includes(role) ?? false,
    refreshSession: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  };
}

type RouteLocationState = {
  from?: string;
  reason?: string;
};

function CurrentLocation() {
  const location = useLocation();
  const state = (location.state ?? {}) as RouteLocationState;

  return (
    <>
      <span data-testid="route-path">{location.pathname}</span>
      <span data-testid="route-from">{state.from ?? ""}</span>
      <span data-testid="route-reason">{state.reason ?? ""}</span>
    </>
  );
}
function renderRoutes(value: AuthContextValue, initialEntry: string) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/unauthorized" element={<><div>401 page</div><CurrentLocation /></>} />
          <Route path="/forbidden" element={<><div>403 page</div><CurrentLocation /></>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard page</div>} />
            <Route path="/profile" element={<div>Profile page</div>} />
            <Route element={<RoleRoute allowedRoles={["admin"]} />}>
              <Route path="/admin" element={<div>Admin page</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("route authorization", () => {
  it("shows a loading state while the session is being checked", () => {
    renderRoutes(authValue("loading"), "/dashboard");
    expect(screen.getByText("Verifying your session")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });

  it("redirects an anonymous user to the 401 page with a complete safe return location", () => {
    renderRoutes(authValue("anonymous"), "/dashboard?tab=security#activity");
    expect(screen.getByText("401 page")).toBeInTheDocument();
    expect(screen.getByTestId("route-path")).toHaveTextContent("/unauthorized");
    expect(screen.getByTestId("route-from")).toHaveTextContent(
      "/dashboard?tab=security#activity",
    );
    expect(screen.getByTestId("route-reason")).toHaveTextContent("authentication-required");
  });

  it("marks a failed session check as a session error", () => {
    renderRoutes(authValue("error"), "/profile?section=security#sessions");
    expect(screen.getByText("401 page")).toBeInTheDocument();
    expect(screen.getByTestId("route-from")).toHaveTextContent(
      "/profile?section=security#sessions",
    );
    expect(screen.getByTestId("route-reason")).toHaveTextContent("session-error");
  });

  it("allows an authenticated investor to access user routes", () => {
    renderRoutes(authValue("authenticated", ["investor"]), "/dashboard");
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("redirects an investor away from admin routes and preserves the denied location", () => {
    renderRoutes(authValue("authenticated", ["investor"]), "/admin?section=operations#queue");
    expect(screen.getByText("403 page")).toBeInTheDocument();
    expect(screen.getByTestId("route-path")).toHaveTextContent("/forbidden");
    expect(screen.getByTestId("route-from")).toHaveTextContent(
      "/admin?section=operations#queue",
    );
  });

  it("allows an administrator to access admin routes", () => {
    renderRoutes(authValue("authenticated", ["admin"]), "/admin");
    expect(screen.getByText("Admin page")).toBeInTheDocument();
  });
});
