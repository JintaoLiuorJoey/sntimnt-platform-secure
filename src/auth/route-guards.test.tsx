import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
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

function renderRoutes(value: AuthContextValue, initialEntry: string) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/unauthorized" element={<div>401 page</div>} />
          <Route path="/forbidden" element={<div>403 page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard page</div>} />
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
  });

  it("redirects an anonymous user to the 401 page", () => {
    renderRoutes(authValue("anonymous"), "/dashboard");
    expect(screen.getByText("401 page")).toBeInTheDocument();
  });

  it("allows an authenticated investor to access user routes", () => {
    renderRoutes(authValue("authenticated", ["investor"]), "/dashboard");
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it("redirects an investor away from admin routes", () => {
    renderRoutes(authValue("authenticated", ["investor"]), "/admin");
    expect(screen.getByText("403 page")).toBeInTheDocument();
  });

  it("allows an administrator to access admin routes", () => {
    renderRoutes(authValue("authenticated", ["admin"]), "/admin");
    expect(screen.getByText("Admin page")).toBeInTheDocument();
  });
});
