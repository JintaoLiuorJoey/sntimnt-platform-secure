import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  pkceChallenge,
  safeInternalReturnTo,
  sha256,
} from "../src/security.js";

describe("authentication security helpers", () => {
  it("accepts only internal return paths", () => {
    expect(safeInternalReturnTo("/profile?tab=security")).toBe("/profile?tab=security");
    expect(safeInternalReturnTo("https://evil.example/phish")).toBe("/dashboard");
    expect(safeInternalReturnTo("//evil.example/phish")).toBe("/dashboard");
    expect(safeInternalReturnTo("/\\evil.example/phish")).toBe("/dashboard");
    expect(safeInternalReturnTo("/api/auth/callback")).toBe("/dashboard");
  });

  it("creates an S256 PKCE challenge", () => {
    const verifier = "test-verifier-with-sufficient-entropy-placeholder";
    expect(pkceChallenge(verifier)).toBe(sha256(verifier));
  });

  it("compares fixed-length secrets without ordinary string equality", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "longer")).toBe(false);
  });
});
