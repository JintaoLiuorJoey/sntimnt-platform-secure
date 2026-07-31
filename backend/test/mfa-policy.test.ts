import { describe, expect, it } from "vitest";
import type { AuthConfig } from "../src/config.js";
import {
  totpEnrollmentDecision,
} from "../src/mfa-policy.js";
import { createSessionRecord } from "../src/session.js";
import type {
  SessionRecord,
  UserRole,
} from "../src/types.js";

const config = {
  absoluteTtlSeconds: 28_800,
  idleTtlSeconds: 1_800,
} as AuthConfig;

function session(input: {
  roles?: UserRole[];
  authenticatedAt?: number;
  tokenExpiresAt?: number;
} = {}): SessionRecord {
  return {
    ...createSessionRecord({
      config,
      now: 1_000,
      user: {
        id: "admin-1",
        email: "admin@example.com",
        displayName: "Administrator",
        roles: input.roles ?? ["admin"],
      },
      subject: "admin-1",
      authenticatedAt: input.authenticatedAt ?? 900,
      refreshTokenCiphertext: "refresh-ciphertext",
      accessTokenCiphertext: "access-ciphertext",
      csrfHash: "csrf-hash",
      tokenExpiresAt: input.tokenExpiresAt ?? 2_000,
    }),
    pk: "AUTH#SESSION#test",
  };
}

describe("TOTP enrollment authorization policy", () => {
  it("allows a recently authenticated administrator with a usable token", () => {
    expect(
      totpEnrollmentDecision(
        session(),
        1_000,
        300,
      ),
    ).toBe("allow");
  });

  it.each([
    "investor",
    "operations",
  ] as const)(
    "rejects the %s role",
    (role) => {
      expect(
        totpEnrollmentDecision(
          session({ roles: [role] }),
          1_000,
          300,
        ),
      ).toBe("forbidden");
    },
  );

  it("requires recent authentication for an administrator", () => {
    expect(
      totpEnrollmentDecision(
        session({ authenticatedAt: 699 }),
        1_000,
        300,
      ),
    ).toBe("recent-authentication-required");
  });

  it("requires refresh when the Cognito token is within the expiry reserve", () => {
    expect(
      totpEnrollmentDecision(
        session({ tokenExpiresAt: 1_030 }),
        1_000,
        300,
      ),
    ).toBe("token-refresh-required");
  });
});
