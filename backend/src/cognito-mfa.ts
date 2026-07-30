import {
  AssociateSoftwareTokenCommand,
  CognitoIdentityProviderClient,
  SetUserMFAPreferenceCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { AuthConfig } from "./config.js";

export type CognitoMfaClient = Pick<
  CognitoIdentityProviderClient,
  "send"
>;

function requireAccessToken(accessToken: string): void {
  if (
    !accessToken ||
    accessToken.trim() !== accessToken
  ) {
    throw new Error("A valid Cognito access token is required.");
  }
}

function requireTotpCode(userCode: string): void {
  if (!/^[0-9]{6}$/.test(userCode)) {
    throw new Error("The TOTP verification code must contain six digits.");
  }
}

function validSecretCode(secretCode: unknown): secretCode is string {
  return (
    typeof secretCode === "string" &&
    secretCode.length >= 16 &&
    /^[A-Za-z0-9]+$/.test(secretCode)
  );
}

export class CognitoMfaService {
  private readonly client: CognitoMfaClient;

  constructor(
    config: AuthConfig,
    client?: CognitoMfaClient,
  ) {
    this.client =
      client ??
      new CognitoIdentityProviderClient({
        region: config.region,
      });
  }

  async startTotpEnrollment(
    accessToken: string,
  ): Promise<{ secretCode: string }> {
    requireAccessToken(accessToken);

    const response = await this.client.send(
      new AssociateSoftwareTokenCommand({
        AccessToken: accessToken,
      }),
    );

    if (!validSecretCode(response.SecretCode)) {
      throw new Error(
        "Cognito returned an invalid TOTP enrollment secret.",
      );
    }

    return {
      secretCode: response.SecretCode,
    };
  }

  async verifyTotpEnrollment(
    accessToken: string,
    userCode: string,
  ): Promise<void> {
    requireAccessToken(accessToken);
    requireTotpCode(userCode);

    const response = await this.client.send(
      new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: userCode,
      }),
    );

    if (response.Status !== "SUCCESS") {
      throw new Error("Cognito did not verify the TOTP enrollment.");
    }
  }

  async activateTotpMfa(accessToken: string): Promise<void> {
    requireAccessToken(accessToken);

    await this.client.send(
      new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true,
        },
      }),
    );
  }
}
