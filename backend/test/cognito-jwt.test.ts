import { generateKeyPairSync, sign } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CognitoService } from "../src/cognito.js";
import type { AuthConfig } from "../src/config.js";

const issuer = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_example";
const clientId = "client-id";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "test-key",
  alg: "RS256",
  use: "sig",
};

const config = {
  clientId,
  cognitoIssuer: issuer,
  cognitoDomain: "https://example.auth.us-east-1.amazoncognito.com",
} as AuthConfig;

function token(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "user-123",
      email: "investor@example.com",
      email_verified: true,
      name: "Example Investor",
      "cognito:groups": ["investor"],
      iss: issuer,
      aud: clientId,
      token_use: "id",
      nonce: "nonce-123",
      iat: now,
      exp: now + 3600,
      ...overrides,
    }),
  ).toString("base64url");
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${header}.${payload}`, "utf8"),
    privateKey,
  ).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

describe("Cognito ID token verification", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ keys: [jwk] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a correctly signed token with the expected issuer, audience, and nonce", async () => {
    const identity = await new CognitoService(config).verifyIdentity(
      token(),
      "nonce-123",
    );
    expect(identity.user.roles).toEqual(["investor"]);
    expect(identity.subject).toBe("user-123");
  });

  it("rejects a token for another app client", async () => {
    await expect(
      new CognitoService(config).verifyIdentity(token({ aud: "other-client" }), "nonce-123"),
    ).rejects.toThrow("audience");
  });

  it("rejects a token with an issue time in the future", async () => {
    const future = Math.floor(Date.now() / 1000) + 600;
    await expect(
      new CognitoService(config).verifyIdentity(token({ iat: future }), "nonce-123"),
    ).rejects.toThrow("issue time");
  });
});
