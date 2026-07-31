import {
  describe,
  expect,
  it,
} from "vitest";
import {
  adminMfaConfigurationDecision,
} from "../src/admin-mfa-policy.js";
import type {
  CognitoUserMfaStatus,
} from "../src/cognito-mfa.js";
import type {
  AuthenticatedUser,
  UserRole,
} from "../src/types.js";

function user(
  roles: UserRole[],
): AuthenticatedUser {
  return {
    id: "user-1",
    email: "user@example.com",
    displayName: "User",
    roles,
  };
}

const notConfigured = {
  softwareTokenMfaEnabled: false,
  softwareTokenMfaPreferred: false,
} satisfies CognitoUserMfaStatus;

describe(
  "administrator MFA configuration policy",
  () => {
    it.each([
      "investor",
      "operations",
    ] as const)(
      "does not impose the administrator policy on the %s role",
      (role) => {
        expect(
          adminMfaConfigurationDecision(
            user([role]),
            notConfigured,
          ),
        ).toBe("not-required");
      },
    );

    it("accepts an administrator with activated and preferred TOTP", () => {
      expect(
        adminMfaConfigurationDecision(
          user(["admin"]),
          {
            softwareTokenMfaEnabled: true,
            softwareTokenMfaPreferred: true,
          },
        ),
      ).toBe("configured");
    });

    it("applies the administrator policy when the user has additional roles", () => {
      expect(
        adminMfaConfigurationDecision(
          user([
            "investor",
            "admin",
          ]),
          {
            softwareTokenMfaEnabled: true,
            softwareTokenMfaPreferred: true,
          },
        ),
      ).toBe("configured");
    });

    it.each([
      {
        description:
          "TOTP is neither activated nor preferred",
        status: {
          softwareTokenMfaEnabled: false,
          softwareTokenMfaPreferred: false,
        },
      },
      {
        description:
          "TOTP is activated but not preferred",
        status: {
          softwareTokenMfaEnabled: true,
          softwareTokenMfaPreferred: false,
        },
      },
      {
        description:
          "TOTP is preferred but not reported as activated",
        status: {
          softwareTokenMfaEnabled: false,
          softwareTokenMfaPreferred: true,
        },
      },
    ] satisfies Array<{
      description: string;
      status: CognitoUserMfaStatus;
    }>)(
      "requires enrollment when $description",
      ({ status }) => {
        expect(
          adminMfaConfigurationDecision(
            user(["admin"]),
            status,
          ),
        ).toBe(
          "enrollment-required",
        );
      },
    );
  },
);
