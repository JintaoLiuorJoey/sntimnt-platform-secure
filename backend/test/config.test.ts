import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

const baseEnvironment: NodeJS.ProcessEnv = {
  AWS_REGION: "us-east-1",
  AUTH_TABLE_NAME: "auth-table",
  AUTH_KMS_KEY_ID: "kms-key",
  COGNITO_USER_POOL_ID: "us-east-1_example",
  COGNITO_CLIENT_ID: "client-id",
  COGNITO_DOMAIN: "https://example.auth.us-east-1.amazoncognito.com",
  COGNITO_ISSUER:
    "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_example",
  APP_ORIGIN: "https://app.example.com",
  AUTH_CALLBACK_URL: "https://app.example.com/api/auth/callback",
};

function environment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    ...baseEnvironment,
    ...overrides,
  };
}

describe("authentication configuration", () => {
  it("uses a five-minute recent-authentication window by default", () => {
    expect(
      loadConfig(environment()).recentAuthenticationMaxAgeSeconds,
    ).toBe(300);
  });

  it("accepts a recent-authentication window inside the policy range", () => {
    expect(
      loadConfig(
        environment({
          RECENT_AUTHENTICATION_MAX_AGE_SECONDS: "600",
        }),
      ).recentAuthenticationMaxAgeSeconds,
    ).toBe(600);
  });

  it.each([
    ["below the minimum", "59"],
    ["above the maximum", "901"],
    ["fractional", "300.5"],
    ["not numeric", "five-minutes"],
  ])(
    "rejects a recent-authentication window that is %s",
    (_description, value) => {
      expect(() =>
        loadConfig(
          environment({
            RECENT_AUTHENTICATION_MAX_AGE_SECONDS: value,
          }),
        ),
      ).toThrow("between 60 and 900");
    },
  );
});
