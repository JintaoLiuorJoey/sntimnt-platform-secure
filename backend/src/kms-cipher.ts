import { DecryptCommand, EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import type { AuthConfig } from "./config.js";
import { sha256 } from "./security.js";

export class KmsCipher {
  constructor(
    private readonly config: AuthConfig,
    private readonly client = new KMSClient({ region: config.region }),
  ) {}

  async encrypt(value: string, purpose: string, contextId: string): Promise<string> {
    const response = await this.client.send(
      new EncryptCommand({
        KeyId: this.config.kmsKeyId,
        Plaintext: Buffer.from(value, "utf8"),
        EncryptionContext: { purpose, contextHash: sha256(contextId) },
      }),
    );

    if (!response.CiphertextBlob) throw new Error("KMS did not return ciphertext.");
    return Buffer.from(response.CiphertextBlob).toString("base64");
  }

  async decrypt(ciphertext: string, purpose: string, contextId: string): Promise<string> {
    const response = await this.client.send(
      new DecryptCommand({
        KeyId: this.config.kmsKeyId,
        CiphertextBlob: Buffer.from(ciphertext, "base64"),
        EncryptionContext: { purpose, contextHash: sha256(contextId) },
      }),
    );

    if (!response.Plaintext) throw new Error("KMS did not return plaintext.");
    return Buffer.from(response.Plaintext).toString("utf8");
  }
}
