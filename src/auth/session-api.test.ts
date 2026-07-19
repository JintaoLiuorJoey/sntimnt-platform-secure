import { beforeEach, describe, expect, it, vi } from "vitest";
import { endSession } from "@/auth/session-api";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/config/runtime", () => ({
  runtimeConfig: {
    isApi: true,
    apiBaseUrl: "https://api.example.invalid",
  },
}));

vi.stubGlobal("fetch", fetchMock);

describe("session API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("ends the server session with an authenticated POST request", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await endSession();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.invalid/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }),
    );
  });
});
