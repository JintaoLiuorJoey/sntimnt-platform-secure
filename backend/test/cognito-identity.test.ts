import { describe, expect, it } from "vitest";
import { identityFromClaims, type IdTokenClaims } from "../src/identity.js";

function payload(overrides: Record<string, unknown> = {}): IdTokenClaims {
  return {
    sub: "user-123",
    email: "investor@example.com",
    email_verified: true,
    name: "Example Investor",
    "cognito:groups": ["investor"],
    exp: 2_000_000_000,
    iat: 1_999_996_400,
    auth_time: 1_999_996_400,
    iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_example",
    aud: "client-id",
    token_use: "id",
    ...overrides,
  };
}

describe("Cognito identity mapping", () => {
  it("maps only allowlisted Cognito groups to application roles", () => {
    expect(identityFromClaims(payload()).user.roles).toEqual(["investor"]);
  });

  it("fails closed when the user has no application group", () => {
    expect(() => identityFromClaims(payload({ "cognito:groups": ["unknown"] }))).toThrow(
      "not assigned",
    );
  });

  it("requires a verified email", () => {
    expect(() => identityFromClaims(payload({ email_verified: false }))).toThrow(
      "verified email",
    );
  });
});
