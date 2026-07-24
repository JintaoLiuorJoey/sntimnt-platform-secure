import { beforeEach, describe, expect, it, vi } from "vitest";
import { endSession, renewSession } from "@/auth/session-api";

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
  expiresAt: "2030-01-01T00:00:00.000Z",
  refreshAfter: "2029-12-31T23:30:00.000Z",
};

describe("session API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    document.cookie = "sntimnt_csrf=csrf-test; Path=/";
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
});
