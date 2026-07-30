import {
  AssociateSoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { describe, expect, it, vi } from "vitest";
import {
  CognitoMfaService,
  type CognitoMfaClient,
} from "../src/cognito-mfa.js";
import type { AuthConfig } from "../src/config.js";

const config = {
  region: "us-east-1",
} as AuthConfig;

function createService(...responses: unknown[]) {
  const send = vi.fn();

  for (const response of responses) {
    send.mockResolvedValueOnce(response);
  }

  const client = {
    send,
  } as unknown as CognitoMfaClient;

  return {
    service: new CognitoMfaService(config, client),
    send,
  };
}

describe("Cognito TOTP enrollment service", () => {
  it("begins enrollment with the current user's access token", async () => {
    const { service, send } = createService({
      SecretCode: "ABCDEFGHIJKLMNOP",
    });

    await expect(
      service.startTotpEnrollment("access-token"),
    ).resolves.toEqual({
      secretCode: "ABCDEFGHIJKLMNOP",
    });

    const command = send.mock.calls[0]?.[0] as
      | AssociateSoftwareTokenCommand
      | undefined;

    expect(command).toBeInstanceOf(AssociateSoftwareTokenCommand);
    expect(command?.input).toEqual({
      AccessToken: "access-token",
    });
  });

  it.each([
    ["missing", {}],
    ["too short", { SecretCode: "ABC123" }],
    [
      "not alphanumeric",
      { SecretCode: "ABCDEFGHIJKLMNO-" },
    ],
  ])(
    "fails closed when the enrollment secret is %s",
    async (_description, response) => {
      const { service } = createService(response);

      await expect(
        service.startTotpEnrollment("access-token"),
      ).rejects.toThrow("invalid TOTP enrollment secret");
    },
  );

  it.each([
    ["empty", ""],
    ["leading whitespace", " access-token"],
    ["trailing whitespace", "access-token "],
  ])(
    "rejects an access token that is %s",
    async (_description, accessToken) => {
      const { service, send } = createService();

      await expect(
        service.startTotpEnrollment(accessToken),
      ).rejects.toThrow("access token");

      expect(send).not.toHaveBeenCalled();
    },
  );

  it("verifies a six-digit TOTP using the access token", async () => {
    const { service, send } = createService({
      Status: "SUCCESS",
    });

    await expect(
      service.verifyTotpEnrollment(
        "access-token",
        "123456",
      ),
    ).resolves.toBeUndefined();

    const command = send.mock.calls[0]?.[0] as
      | VerifySoftwareTokenCommand
      | undefined;

    expect(command).toBeInstanceOf(VerifySoftwareTokenCommand);
    expect(command?.input).toEqual({
      AccessToken: "access-token",
      UserCode: "123456",
    });
  });

  it.each([
    ["too short", "12345"],
    ["too long", "1234567"],
    ["not numeric", "12345a"],
  ])(
    "rejects a TOTP code that is %s",
    async (_description, userCode) => {
      const { service, send } = createService();

      await expect(
        service.verifyTotpEnrollment(
          "access-token",
          userCode,
        ),
      ).rejects.toThrow("six digits");

      expect(send).not.toHaveBeenCalled();
    },
  );

  it("fails closed when Cognito does not report verification success", async () => {
    const { service } = createService({
      Status: "ERROR",
    });

    await expect(
      service.verifyTotpEnrollment(
        "access-token",
        "123456",
      ),
    ).rejects.toThrow("did not verify");
  });

  it("enables and prefers software-token MFA", async () => {
    const { service, send } = createService({});

    await expect(
      service.activateTotpMfa("access-token"),
    ).resolves.toBeUndefined();

    const command = send.mock.calls[0]?.[0] as
      | SetUserMFAPreferenceCommand
      | undefined;

    expect(command).toBeInstanceOf(
      SetUserMFAPreferenceCommand,
    );

    expect(command?.input).toEqual({
      AccessToken: "access-token",
      SoftwareTokenMfaSettings: {
        Enabled: true,
        PreferredMfa: true,
      },
    });
  });
});
