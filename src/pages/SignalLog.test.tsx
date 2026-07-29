import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  AuthContext,
  type AuthContextValue,
} from "@/auth/auth-context";
import type { AuthenticatedUser, AuthSession } from "@/auth/auth-types";
import SignalLog from "@/pages/SignalLog";

const user: AuthenticatedUser = {
  id: "signal-boundary-test-user",
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

const renderSignalLog = () =>
  render(
    <MemoryRouter>
      <AuthContext.Provider value={authValue}>
        <SignalLog />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

describe("Signal Log data boundary", () => {
  it("fails closed while the authorized signal API is unavailable", () => {
    renderSignalLog();

    expect(
      screen.getByRole("heading", { name: "Signal history unavailable" }),
    ).toBeInTheDocument();
  });

  it("does not render embedded signals, results, filters, or exports", () => {
    renderSignalLog();

    expect(screen.queryByText("Trades Executed")).not.toBeInTheDocument();
    expect(screen.queryByText("All Signals")).not.toBeInTheDocument();
    expect(screen.queryByText("Strong Bullish")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /export csv/i }),
    ).not.toBeInTheDocument();
  });
});
