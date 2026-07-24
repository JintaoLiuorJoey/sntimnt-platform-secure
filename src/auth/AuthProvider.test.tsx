import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/auth/AuthProvider";
import { useAuth } from "@/auth/auth-context";
import type { AuthSession } from "@/auth/auth-types";

const sessionApiMocks = vi.hoisted(() => ({
  fetchSession: vi.fn(),
  endSession: vi.fn(),
  renewSession: vi.fn(),
}));

vi.mock("@/auth/session-api", () => sessionApiMocks);

const activeSession: AuthSession = {
  user: {
    id: "usr-test-001",
    email: "investor@example.invalid",
    displayName: "Test Investor",
    roles: ["investor"],
  },
  expiresAt: "2030-01-01T00:00:01.000Z",
};

function LoginLocation() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

function LogoutButton() {
  const { logout } = useAuth();
  return <button onClick={() => void logout().catch(() => undefined)}>Log out</button>;
}

describe("AuthProvider session lifecycle", () => {
  beforeEach(() => {
    sessionApiMocks.fetchSession.mockReset();
    sessionApiMocks.endSession.mockReset();
    sessionApiMocks.renewSession.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears an expired session and returns to login", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    sessionApiMocks.fetchSession.mockResolvedValue(activeSession);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/login" element={<LoginLocation />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1_001);
    });

    expect(
      screen.getByText("/login?returnTo=%2Fdashboard&reason=session-expired"),
    ).toBeInTheDocument();
  });
  it("calls the server logout endpoint before clearing the browser session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2029-12-31T23:00:00.000Z"));
    sessionApiMocks.fetchSession.mockResolvedValue(activeSession);
    sessionApiMocks.endSession.mockResolvedValue(undefined);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <Routes>
            <Route path="/dashboard" element={<LogoutButton />} />
            <Route path="/login" element={<LoginLocation />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(sessionApiMocks.endSession).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("/login?returnTo=%2Fdashboard&reason=logged-out"),
    ).toBeInTheDocument();
  });

  it("does not refresh an idle browser session in the background", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    sessionApiMocks.fetchSession.mockResolvedValue({
      ...activeSession,
      expiresAt: "2030-01-01T01:00:00.000Z",
      refreshAfter: "2030-01-01T00:06:00.000Z",
    });
    sessionApiMocks.renewSession.mockResolvedValue(activeSession);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/login" element={<LoginLocation />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(6 * 60 * 1000 + 1);
    });

    expect(sessionApiMocks.renewSession).not.toHaveBeenCalled();
  });

});
