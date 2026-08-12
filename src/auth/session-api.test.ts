import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeTotpEnrollment,
  endSession,
  renewSession,
  startTotpEnrollment,
} from "@/auth/session-api";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/config/runtime", () => ({
  runtimeConfig: {
    isApi: true,
    apiBaseUrl: "https://api.example.invalid",
  },
}));

vi.stubGlobal("fetch", fetchMock);

const sessionResponse = {
  user: {
    id: "usr-test-001",
    email: "investor@example.invalid",
    displayName: "Test Investor",
    roles: ["investor"],
  },
  adminMfaConfiguration: "not-required",
  expiresAt: "2030-01-01T00:00:00.000Z",
  refreshAfter: "2029-12-31T23:30:00.000Z",
};

describe("session API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("document", { cookie: "sntimnt_csrf=csrf-test" });
  });

  it("ends the server session with an authenticated CSRF-protected POST request", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await endSession();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-test" }),
      }),
    );
  });

  it("renews the opaque server session without returning Cognito tokens", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(sessionResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(renewSession()).resolves.toEqual(sessionResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/api/auth/refresh",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-test" }),
      }),
    );
  });

  it("starts TOTP enrollment with credentials and CSRF proof", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ secretCode: "JBSWY3DPEHPK3PXP" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(startTotpEnrollment()).resolves.toBe("JBSWY3DPEHPK3PXP");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/api/auth/mfa/totp/start",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-test" }),
      }),
    );
  });

  it("completes TOTP enrollment with only the six-digit user code", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(completeTotpEnrollment("123456")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/api/auth/mfa/totp/complete",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ userCode: "123456" }),
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-test" }),
      }),
    );
  });

  it("rejects an invalid verification code before making a request", async () => {
    await expect(completeTotpEnrollment("12 3456")).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
