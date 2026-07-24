import { describe, expect, it } from "vitest";
import {
  buildLoginEndpoint,
  buildLoginPagePath,
  loginNoticeFor,
  safeInternalReturnTo,
} from "@/auth/auth-navigation";

describe("authentication navigation", () => {
  it("accepts only internal return paths", () => {
    expect(safeInternalReturnTo("/performance?range=30d")).toBe("/performance?range=30d");
    expect(safeInternalReturnTo("https://evil.example/phish")).toBe("/dashboard");
    expect(safeInternalReturnTo("//evil.example/phish")).toBe("/dashboard");
    expect(safeInternalReturnTo("/\\evil.example/phish")).toBe("/dashboard");
    expect(safeInternalReturnTo("/login")).toBe("/dashboard");
  });

  it("builds the backend login endpoint without putting credentials in the browser", () => {
    expect(buildLoginEndpoint("https://api.example.invalid", "/signals")).toBe(
      "https://api.example.invalid/api/auth/login?returnTo=%2Fsignals",
    );
  });

  it("builds a generic session-expired login route", () => {
    expect(buildLoginPagePath("/profile", "session-expired")).toBe(
      "/login?returnTo=%2Fprofile&reason=session-expired",
    );
  });

  it("maps only allowlisted generic notices", () => {
    expect(loginNoticeFor("authentication-failed")).toBe(
      "We could not complete sign-in. Please try again.",
    );
    expect(loginNoticeFor("unknown-account")).toBeNull();
  });
});
