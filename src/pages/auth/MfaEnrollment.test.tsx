import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/auth/auth-context";
import MfaEnrollment from "@/pages/auth/MfaEnrollment";

const apiMocks = vi.hoisted(() => ({
  start: vi.fn(),
  complete: vi.fn(),
}));

const qrMocks = vi.hoisted(() => ({
  toDataURL: vi.fn(),
}));

vi.mock("@/auth/session-api", () => ({
  SessionApiError: class SessionApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
  startTotpEnrollment: apiMocks.start,
  completeTotpEnrollment: apiMocks.complete,
}));

vi.mock("@/auth/auth-navigation", () => ({
  safeInternalReturnTo: (value: string) => value,
}));

vi.mock("@/auth/session-events", () => ({
  notifySessionExpired: vi.fn(),
}));

vi.mock("qrcode", () => ({
  default: qrMocks,
}));

afterEach(cleanup);

describe("administrator MFA enrollment", () => {
  const refreshSession = vi.fn(async () => undefined);
  const authValue: AuthContextValue = {
    status: "authenticated",
    session: {
      user: {
        id: "admin-1",
        email: "admin@example.com",
        displayName: "Administrator",
        roles: ["admin"],
      },
      adminMfaConfiguration: "enrollment-required",
      expiresAt: "2030-01-01T00:00:00.000Z",
    },
    user: {
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Administrator",
      roles: ["admin"],
    },
    isAuthenticated: true,
    hasRole: (role) => role === "admin",
    refreshSession,
    logout: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    apiMocks.start.mockReset().mockResolvedValue("JBSWY3DPEHPK3PXP");
    apiMocks.complete.mockReset().mockResolvedValue(undefined);
    qrMocks.toDataURL.mockReset().mockResolvedValue("data:image/png;base64,qr");
    refreshSession.mockClear();
  });

  it("renders a local QR code and manual setup key", async () => {
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={["/mfa/enroll"]}>
          <MfaEnrollment />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(await screen.findByAltText("Authenticator setup QR code")).toHaveAttribute(
      "src",
      "data:image/png;base64,qr",
    );
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    expect(qrMocks.toDataURL).toHaveBeenCalledWith(
      expect.stringContaining("secret=JBSWY3DPEHPK3PXP"),
      expect.any(Object),
    );
  });

  it("submits only a six-digit code, refreshes the session, and returns", async () => {
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/mfa/enroll",
              state: { from: "/admin?section=operations" },
            },
          ]}
        >
          <Routes>
            <Route path="/mfa/enroll" element={<MfaEnrollment />} />
            <Route path="/admin" element={<div>Admin destination</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const input = await screen.findByRole("textbox", { name: "2. Verify a code" });
    fireEvent.change(input, { target: { value: "12a3456" } });
    expect(input).toHaveValue("123456");

    fireEvent.click(screen.getByRole("button", { name: "Complete MFA setup" }));

    await waitFor(() => expect(apiMocks.complete).toHaveBeenCalledWith("123456"));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Admin destination")).toBeInTheDocument();
  });
});
