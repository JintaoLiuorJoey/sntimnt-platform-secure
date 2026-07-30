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

  it("maps the original authentication time", () => {
    expect(identityFromClaims(payload()).authenticatedAt).toBe(1_999_996_400);
  });

  it("rejects a missing authentication time", () => {
    const claims = payload();
    delete claims.auth_time;

    expect(() => identityFromClaims(claims)).toThrow("authentication time");
  });

  it.each([
    ["a string", "1999996400"],
    ["a fractional number", 1_999_996_400.5],
    ["a negative number", -1],
    ["later than token issuance", 1_999_996_401],
  ])("rejects an authentication time that is %s", (_description, authTime) => {
    expect(() => identityFromClaims(payload({ auth_time: authTime }))).toThrow(
      "authentication time",
    );
  });

  it("rejects authentication time when token issue time is malformed", () => {
    expect(() =>
      identityFromClaims(payload({ iat: "1999996400" })),
    ).toThrow("authentication time");
  });

  it("fails closed when the user has no application group", () => {
    expect(() => identityFromClaims(payload({ "cognito:groups": ["unknown"] }))).toThrow(
      "not assigned",
    );
  });

  it("rejects a missing email verification claim", () => {
    const claims = payload();
    delete claims.email_verified;

    expect(() => identityFromClaims(claims)).toThrow("verified email");
  });

  it.each([
    ["false", false],
    ['the string "true"', "true"],
    ["the number 1", 1],
  ])(
    "rejects email verification when it is %s",
    (_description, emailVerified) => {
      expect(() =>
        identityFromClaims(payload({ email_verified: emailVerified })),
      ).toThrow("verified email");
    },
  );

  it("rejects a missing email claim", () => {
    const claims = payload();
    delete claims.email;

    expect(() => identityFromClaims(claims)).toThrow("verified email");
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["non-string", 123],
  ])("rejects an email claim that is %s", (_description, email) => {
    expect(() => identityFromClaims(payload({ email }))).toThrow(
      "verified email",
    );
  });

  it("trims surrounding email whitespace before creating the identity", () => {
    const identity = identityFromClaims(
      payload({ email: " investor@example.com " }),
    );

    expect(identity.user.email).toBe("investor@example.com");
  });
});
