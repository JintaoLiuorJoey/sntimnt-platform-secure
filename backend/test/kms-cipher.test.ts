import { describe, expect, it, vi } from "vitest";
import type { AuthConfig } from "../src/config.js";
import { KmsCipher } from "../src/kms-cipher.js";
import { sha256 } from "../src/security.js";

const config = {
  region: "us-east-1",
  kmsKeyId: "arn:aws:kms:us-east-1:123456789012:key/test",
} as AuthConfig;

describe("KMS token encryption", () => {
  it("hashes sensitive context identifiers before sending them to KMS", async () => {
    const send = vi.fn().mockResolvedValue({ CiphertextBlob: new Uint8Array([1, 2, 3]) });
    const cipher = new KmsCipher(config, { send } as never);

    await cipher.encrypt("refresh-token", "cognito-refresh-token", "raw-session-id");

    const command = send.mock.calls[0]?.[0] as {
      input: { EncryptionContext: Record<string, string> };
    };
    expect(command.input.EncryptionContext).toEqual({
      purpose: "cognito-refresh-token",
      contextHash: sha256("raw-session-id"),
    });
    expect(JSON.stringify(command.input.EncryptionContext)).not.toContain("raw-session-id");
  });
});
