import { describe, expect, it } from "vitest";
import { csrfHeadersForMethod, readCsrfToken } from "@/auth/csrf-cookie";

describe("CSRF cookie helpers", () => {
  it("reads the production host-only CSRF cookie", () => {
    expect(readCsrfToken("other=1; __Host-sntimnt_csrf=token-123")).toBe("token-123");
  });

  it("does not add a CSRF header to safe methods", () => {
    expect(csrfHeadersForMethod("GET")).toEqual({});
  });
});
