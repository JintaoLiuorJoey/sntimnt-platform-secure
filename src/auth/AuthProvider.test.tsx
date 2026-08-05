import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/auth/AuthProvider";
import { useAuth } from "@/auth/auth-context";
import { notifySessionExpired } from "@/auth/session-events";
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

function AuthState() {
  const { status, user } = useAuth();

  return (
    <>
      <div data-testid="auth-status">{status}</div>
      <div data-testid="auth-user">{user?.displayName ?? "none"}</div>
    </>
  );
}

describe("AuthProvider session lifecycle", () => {
  beforeEach(() => {
    sessionApiMocks.fetchSession.mockReset();
    sessionApiMocks.endSession.mockReset();
    sessionApiMocks.renewSession.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });


  it("restores an authenticated server session during startup", async () => {
    sessionApiMocks.fetchSession.mockResolvedValue(activeSession);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <AuthState />
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByTestId("auth-status"),
    ).toHaveTextContent(
      "authenticated",
    );

    expect(
      screen.getByTestId("auth-user"),
    ).toHaveTextContent(
      "Test Investor",
    );

    expect(
      sessionApiMocks.fetchSession,
    ).toHaveBeenCalledTimes(1);

    const signal =
      sessionApiMocks.fetchSession
        .mock.calls[0]?.[0];

    expect(
      signal,
    ).toBeInstanceOf(
      AbortSignal,
    );

    expect(
      sessionApiMocks.renewSession,
    ).not.toHaveBeenCalled();

    expect(
      sessionApiMocks.endSession,
    ).not.toHaveBeenCalled();
  });

  it("starts anonymously when the server has no session", async () => {
    sessionApiMocks.fetchSession.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <AuthState />
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByTestId("auth-status"),
    ).toHaveTextContent(
      "anonymous",
    );

    expect(
      screen.getByTestId("auth-user"),
    ).toHaveTextContent(
      "none",
    );

    expect(
      sessionApiMocks.renewSession,
    ).not.toHaveBeenCalled();
  });

  it("fails closed when the initial session request fails", async () => {
    sessionApiMocks.fetchSession.mockRejectedValue(
      new Error(
        "Authentication service unavailable",
      ),
    );

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <AuthState />
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByTestId("auth-status"),
    ).toHaveTextContent(
      "error",
    );

    expect(
      screen.getByTestId("auth-user"),
    ).toHaveTextContent(
      "none",
    );

    expect(
      sessionApiMocks.renewSession,
    ).not.toHaveBeenCalled();

    expect(
      sessionApiMocks.endSession,
    ).not.toHaveBeenCalled();
  });

  it("clears the session when an authenticated API request reports 401", async () => {
    sessionApiMocks.fetchSession.mockResolvedValue(activeSession);

    render(
      <MemoryRouter initialEntries={["/signals?filter=open"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/signals"
              element={
                <div>
                  Signals
                </div>
              }
            />
            <Route
              path="/login"
              element={
                <LoginLocation />
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText("Signals"),
    ).toBeInTheDocument();

    await act(async () => {
      notifySessionExpired();
    });

    expect(
      screen.getByText(
        "/login?returnTo=%2Fsignals%3Ffilter%3Dopen&reason=session-expired",
      ),
    ).toBeInTheDocument();

    expect(
      sessionApiMocks.renewSession,
    ).not.toHaveBeenCalled();
  });

  it("clears local state when server logout cannot be confirmed", async () => {
    sessionApiMocks.fetchSession.mockResolvedValue(activeSession);

    sessionApiMocks.endSession.mockRejectedValue(
      new Error(
        "Logout endpoint unavailable",
      ),
    );

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <LogoutButton />
              }
            />
            <Route
              path="/login"
              element={
                <LoginLocation />
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole(
          "button",
          {
            name: "Log out",
          },
        ),
      );

      await Promise.resolve();
    });

    expect(
      sessionApiMocks.endSession,
    ).toHaveBeenCalledTimes(1);

    expect(
      screen.getByText(
        "/login?returnTo=%2Fdashboard&reason=logout-incomplete",
      ),
    ).toBeInTheDocument();
  });

  it("renews an active visible session at the server refresh boundary", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date(
        "2030-01-01T00:00:00.000Z",
      ),
    );

    vi.spyOn(
      document,
      "visibilityState",
      "get",
    ).mockReturnValue(
      "visible",
    );

    sessionApiMocks.fetchSession.mockResolvedValue({
      ...activeSession,
      expiresAt:
        "2030-01-01T01:00:00.000Z",
      refreshAfter:
        "2030-01-01T00:01:00.000Z",
    });

    sessionApiMocks.renewSession.mockResolvedValue({
      ...activeSession,
      user: {
        ...activeSession.user,
        displayName:
          "Renewed Investor",
      },
      expiresAt:
        "2030-01-01T02:00:00.000Z",
      refreshAfter:
        "2030-01-01T01:30:00.000Z",
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <AuthState />
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByTestId("auth-user"),
    ).toHaveTextContent(
      "Test Investor",
    );

    await act(async () => {
      vi.advanceTimersByTime(
        60_001,
      );

      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      sessionApiMocks.renewSession,
    ).toHaveBeenCalledTimes(1);

    expect(
      screen.getByTestId("auth-status"),
    ).toHaveTextContent(
      "authenticated",
    );

    expect(
      screen.getByTestId("auth-user"),
    ).toHaveTextContent(
      "Renewed Investor",
    );
  });

  it("returns to login when scheduled session renewal fails", async () => {
    vi.useFakeTimers();

    vi.setSystemTime(
      new Date(
        "2030-01-01T00:00:00.000Z",
      ),
    );

    vi.spyOn(
      document,
      "visibilityState",
      "get",
    ).mockReturnValue(
      "visible",
    );

    sessionApiMocks.fetchSession.mockResolvedValue({
      ...activeSession,
      expiresAt:
        "2030-01-01T01:00:00.000Z",
      refreshAfter:
        "2030-01-01T00:01:00.000Z",
    });

    sessionApiMocks.renewSession.mockRejectedValue(
      new Error(
        "Session renewal unavailable",
      ),
    );

    render(
      <MemoryRouter initialEntries={["/performance?range=1y"]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/performance"
              element={
                <div>
                  Performance
                </div>
              }
            />
            <Route
              path="/login"
              element={
                <LoginLocation />
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText(
        "Performance",
      ),
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(
        60_001,
      );

      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      sessionApiMocks.renewSession,
    ).toHaveBeenCalledTimes(1);

    expect(
      screen.getByText(
        "/login?returnTo=%2Fperformance%3Frange%3D1y&reason=session-expired",
      ),
    ).toBeInTheDocument();
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
