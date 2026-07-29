import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  AuthContext,
  type AuthContextValue,
} from "@/auth/auth-context";
import type { AuthenticatedUser, AuthSession } from "@/auth/auth-types";
import Dashboard from "@/pages/Dashboard";
import Performance from "@/pages/Performance";

const user: AuthenticatedUser = {
  id: "portfolio-boundary-test-user",
  email: "investor@example.com",
  displayName: "Verified Investor",
  roles: ["investor"],
};

const session: AuthSession = {
  user,
  expiresAt: "2099-01-01T00:00:00.000Z",
  refreshAfter: "2098-12-31T23:30:00.000Z",
};

const authValue: AuthContextValue = {
  status: "authenticated",
  session,
  user,
  isAuthenticated: true,
  hasRole: (role) => user.roles.includes(role),
  refreshSession: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
};

const renderPage = (page: ReactElement) =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        {page}
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("Portfolio data boundary", () => {
  it("shows the validated session identity on the dashboard", () => {
    renderPage(<Dashboard />);

    expect(
      screen.getByText("Signed in as Verified Investor."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Investment account data unavailable",
      }),
    ).toBeInTheDocument();
  });

  it("does not render fabricated dashboard account records", () => {
    renderPage(<Dashboard />);

    expect(screen.queryByText("Portfolio Value")).not.toBeInTheDocument();
    expect(screen.queryByText("Current Positions")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Signals")).not.toBeInTheDocument();
    expect(screen.queryByText("Good morning, Chris.")).not.toBeInTheDocument();
  });

  it("fails closed when performance APIs are unavailable", () => {
    renderPage(<Performance />);

    expect(
      screen.getByRole("heading", { name: "Performance data unavailable" }),
    ).toBeInTheDocument();
  });

  it("does not render fabricated performance results", () => {
    renderPage(<Performance />);

    expect(screen.queryByText("Total Return")).not.toBeInTheDocument();
    expect(screen.queryByText("Sharpe Ratio")).not.toBeInTheDocument();
    expect(screen.queryByText("Monthly Returns")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/AI Portfolio vs\. Benchmarks/i),
    ).not.toBeInTheDocument();
  });
});
