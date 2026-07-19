import { describe, expect, it } from "vitest";
import { authSessionSchema } from "@/auth/auth-types";

const validSession = {
  user: {
    id: "usr_123",
    email: "investor@example.com",
    displayName: "Example Investor",
    roles: ["investor"],
  },
  expiresAt: "2030-01-01T00:00:00.000Z",
};

describe("authSessionSchema", () => {
  it("accepts a valid server session", () => {
    expect(authSessionSchema.safeParse(validSession).success).toBe(true);
  });

  it("rejects roles outside the allowlist", () => {
    const result = authSessionSchema.safeParse({
      ...validSession,
      user: { ...validSession.user, roles: ["superadmin"] },
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed identity data", () => {
    const result = authSessionSchema.safeParse({
      ...validSession,
      user: { ...validSession.user, id: "", email: "not-an-email" },
    });

    expect(result.success).toBe(false);
  });
});
