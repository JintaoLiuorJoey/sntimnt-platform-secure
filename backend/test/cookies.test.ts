import { describe, expect, it } from "vitest";
import { clearAuthCookies, cookieNames, sessionCookies } from "../src/cookies.js";
import type { AuthConfig } from "../src/config.js";

const config = {
  cookieSecure: true,
} as AuthConfig;

describe("authentication cookies", () => {
  it("uses host-only secure cookie names in production", () => {
    expect(cookieNames(config)).toEqual({
      session: "__Host-sntimnt_session",
      csrf: "__Host-sntimnt_csrf",
      oauth: "__Host-sntimnt_oauth",
    });
  });

  it("keeps the session cookie HttpOnly while exposing only the CSRF token", () => {
    const [session, csrf] = sessionCookies(config, "session-id", "csrf-token", 600);
    expect(session).toContain("HttpOnly");
    expect(session).toContain("Secure");
    expect(session).toContain("SameSite=Lax");
    expect(session).not.toContain("Domain=");
    expect(csrf).not.toContain("HttpOnly");
  });

  it("clears all authentication cookies", () => {
    expect(clearAuthCookies(config)).toHaveLength(3);
    expect(clearAuthCookies(config).every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });
});
