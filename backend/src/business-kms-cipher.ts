import {
  DecryptCommand,
  EncryptCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import {
  buildBusinessEncryptionContext,
  createBusinessEncryptedValue,
  validateBusinessEncryptedValue,
  type BusinessEncryptedValue,
  type BusinessEncryptionContext,
  type BusinessEncryptionContextInput,
} from "./business-data-protection.js";

export const MAX_DIRECT_BUSINESS_PLAINTEXT_BYTES =
  4_096;

export interface BusinessKmsCipherConfig {
  readonly region: string;
  readonly kmsKeyId: string;
}

type KmsClientLike =
  Pick<KMSClient, "send">;

function validatedConfig(
  config: BusinessKmsCipherConfig,
): BusinessKmsCipherConfig {
  if (
    !config.region ||
    config.region.trim() !== config.region ||
    !config.kmsKeyId ||
    config.kmsKeyId.trim() !== config.kmsKeyId
  ) {
    throw new Error(
      "Business KMS configuration is invalid.",
    );
  }

  return config;
}

function kmsEncryptionContext(
  input: BusinessEncryptionContextInput,
): Record<string, string> {
  const context:
    BusinessEncryptionContext =
      buildBusinessEncryptionContext(input);

  return {
    application: context.application,
    schema: context.schema,
    classification:
      context.classification,
    recordType: context.recordType,
    ownerContextHash:
      context.ownerContextHash,
    recordContextHash:
      context.recordContextHash,
  };
}

function plaintextBytes(
  value: string,
): Buffer {
  if (typeof value !== "string") {
    throw new Error(
      "Business plaintext must be a string.",
    );
  }

  const bytes =
    Buffer.from(
      value,
      "utf8",
    );

  if (
    bytes.length === 0 ||
    bytes.length >
      MAX_DIRECT_BUSINESS_PLAINTEXT_BYTES
  ) {
    throw new Error(
      "Business plaintext must contain between 1 and 4096 UTF-8 bytes.",
    );
  }

  return bytes;
}

export class BusinessKmsCipher {
  private readonly config:
    BusinessKmsCipherConfig;

  private readonly client:
    KmsClientLike;

  constructor(
    config: BusinessKmsCipherConfig,
    client?: KmsClientLike,
  ) {
    this.config =
      validatedConfig(config);

    this.client =
      client ??
      new KMSClient({
        region:
          this.config.region,
      });
  }

  async encrypt(
    value: string,
    input: BusinessEncryptionContextInput,
  ): Promise<BusinessEncryptedValue> {
    const response =
      await this.client.send(
        new EncryptCommand({
          KeyId:
            this.config.kmsKeyId,
          Plaintext:
            plaintextBytes(value),
          EncryptionContext:
            kmsEncryptionContext(input),
        }),
      );

    if (!response.CiphertextBlob) {
      throw new Error(
        "KMS did not return business ciphertext.",
      );
    }

    return createBusinessEncryptedValue(
      input.recordType,
      Buffer.from(
        response.CiphertextBlob,
      ).toString("base64"),
    );
  }

  async decrypt(
    value: unknown,
    input: BusinessEncryptionContextInput,
  ): Promise<string> {
    const encrypted =
      validateBusinessEncryptedValue(
        value,
        input.recordType,
      );

    const response =
      await this.client.send(
        new DecryptCommand({
          KeyId:
            this.config.kmsKeyId,
          CiphertextBlob:
            Buffer.from(
              encrypted.ciphertext,
              "base64",
            ),
          EncryptionContext:
            kmsEncryptionContext(input),
        }),
      );

    if (
      !response.Plaintext ||
      response.Plaintext.length === 0
    ) {
      throw new Error(
        "KMS did not return business plaintext.",
      );
    }

    return Buffer.from(
      response.Plaintext,
    ).toString("utf8");
  }
}
