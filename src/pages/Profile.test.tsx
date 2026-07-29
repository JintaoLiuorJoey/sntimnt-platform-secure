import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  AuthContext,
  type AuthContextValue,
} from "@/auth/auth-context";
import type { AuthenticatedUser, AuthSession } from "@/auth/auth-types";
import Profile from "@/pages/Profile";

const user: AuthenticatedUser = {
  id: "user-profile-test",
  email: "investor@example.com",
  displayName: "Verified Investor",
  roles: ["investor"],
};

const session: AuthSession = {
  user,
  expiresAt: "2099-01-01T00:00:00.000Z",
  refreshAfter: "2098-12-31T23:30:00.000Z",
};

const authenticatedValue: AuthContextValue = {
  status: "authenticated",
  session,
  user,
  isAuthenticated: true,
  hasRole: (role) => user.roles.includes(role),
  refreshSession: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
};

const anonymousValue: AuthContextValue = {
  status: "anonymous",
  session: null,
  user: null,
  isAuthenticated: false,
  hasRole: () => false,
  refreshSession: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
};

const renderProfile = (value: AuthContextValue) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <Profile />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("Profile security boundary", () => {
  it("displays identity only from the validated session", () => {
    renderProfile(authenticatedValue);

    expect(
      screen.getByRole("heading", { name: "Authenticated profile" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Verified Investor").length).toBeGreaterThan(0);
    expect(screen.getByText("investor@example.com")).toBeInTheDocument();
    expect(screen.getByText("Server-validated session")).toBeInTheDocument();
  });

  it("does not expose local banking or transaction forms", () => {
    renderProfile(authenticatedValue);

    expect(screen.queryByLabelText(/routing number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/account number/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit deposit request/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /submit withdrawal request/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save banking info/i }),
    ).not.toBeInTheDocument();
  });

  it("fails closed when no validated session identity exists", () => {
    renderProfile(anonymousValue);

    expect(
      screen.getByRole("heading", { name: "Profile unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Verified Investor")).not.toBeInTheDocument();
  });
});
