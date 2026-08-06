import {
  DecryptCommand,
  EncryptCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  buildBusinessEncryptionContext,
  createBusinessEncryptedValue,
} from "../src/business-data-protection.js";
import {
  BusinessKmsCipher,
  MAX_DIRECT_BUSINESS_PLAINTEXT_BYTES,
} from "../src/business-kms-cipher.js";

const OWNER_ONE =
  "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const OWNER_TWO =
  "BUSINESS#OWNER#BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const config = Object.freeze({
  region: "us-east-1",
  kmsKeyId:
    "arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555",
});

function client(
  send: ReturnType<typeof vi.fn>,
): Pick<KMSClient, "send"> {
  return {
    send,
  } as unknown as
    Pick<KMSClient, "send">;
}

describe(
  "business KMS cipher",
  () => {
    it("encrypts bounded plaintext with the dedicated key and pseudonymous context", async () => {
      const send =
        vi.fn().mockResolvedValue({
          CiphertextBlob:
            new Uint8Array([
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
            ]),
        });

      const cipher =
        new BusinessKmsCipher(
          config,
          client(send),
        );

      const input = {
        ownerPartitionKey:
          OWNER_ONE,
        recordType:
          "investor-profile",
        recordId:
          "profile_000000000001",
      } as const;

      const encrypted =
        await cipher.encrypt(
          '{"givenName":"Ada"}',
          input,
        );

      expect(encrypted).toEqual({
        schemaVersion: 1,
        classification:
          "confidential",
        recordType:
          "investor-profile",
        ciphertext:
          "AQIDBAUGBwg=",
      });

      const command =
        send.mock.calls[0]?.[0];

      expect(
        command,
      ).toBeInstanceOf(
        EncryptCommand,
      );

      if (
        !(
          command instanceof
          EncryptCommand
        )
      ) {
        throw new Error(
          "Expected an EncryptCommand.",
        );
      }

      expect(
        command.input.KeyId,
      ).toBe(
        config.kmsKeyId,
      );

      expect(
        Buffer.from(
          command.input.Plaintext ??
          [],
        ).toString("utf8"),
      ).toBe(
        '{"givenName":"Ada"}',
      );

      expect(
        command.input
          .EncryptionContext,
      ).toEqual(
        buildBusinessEncryptionContext(
          input,
        ),
      );

      const renderedContext =
        JSON.stringify(
          command.input
            .EncryptionContext,
        );

      expect(
        renderedContext,
      ).not.toContain(
        OWNER_ONE,
      );

      expect(
        renderedContext,
      ).not.toContain(
        input.recordId,
      );
    });

    it("decrypts only with the caller-supplied owner and record context", async () => {
      const send =
        vi.fn().mockResolvedValue({
          Plaintext:
            Buffer.from(
              '{"givenName":"Ada"}',
              "utf8",
            ),
        });

      const cipher =
        new BusinessKmsCipher(
          config,
          client(send),
        );

      const input = {
        ownerPartitionKey:
          OWNER_ONE,
        recordType:
          "investor-profile",
        recordId:
          "profile_000000000001",
      } as const;

      await expect(
        cipher.decrypt(
          createBusinessEncryptedValue(
            "investor-profile",
            "AQIDBAUGBwg=",
          ),
          input,
        ),
      ).resolves.toBe(
        '{"givenName":"Ada"}',
      );

      const command =
        send.mock.calls[0]?.[0];

      expect(
        command,
      ).toBeInstanceOf(
        DecryptCommand,
      );

      if (
        !(
          command instanceof
          DecryptCommand
        )
      ) {
        throw new Error(
          "Expected a DecryptCommand.",
        );
      }

      expect(
        command.input.KeyId,
      ).toBe(
        config.kmsKeyId,
      );

      expect(
        command.input
          .EncryptionContext,
      ).toEqual(
        buildBusinessEncryptionContext(
          input,
        ),
      );
    });

    it.each([
      "",
      "é".repeat(2_049),
    ])(
      "rejects an unsupported direct-KMS plaintext size",
      async (value) => {
        const send =
          vi.fn();

        const cipher =
          new BusinessKmsCipher(
            config,
            client(send),
          );

        await expect(
          cipher.encrypt(
            value,
            {
              ownerPartitionKey:
                OWNER_ONE,
              recordType:
                "investor-profile",
              recordId:
                "profile_000000000001",
            },
          ),
        ).rejects.toThrow(
          "between 1 and 4096 UTF-8 bytes",
        );

        expect(
          send,
        ).not.toHaveBeenCalled();
      },
    );

    it("accepts exactly the direct-KMS byte limit", async () => {
      const send =
        vi.fn().mockResolvedValue({
          CiphertextBlob:
            new Uint8Array([
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
            ]),
        });

      const cipher =
        new BusinessKmsCipher(
          config,
          client(send),
        );

      await expect(
        cipher.encrypt(
          "a".repeat(
            MAX_DIRECT_BUSINESS_PLAINTEXT_BYTES,
          ),
          {
            ownerPartitionKey:
              OWNER_ONE,
            recordType:
              "investor-profile",
            recordId:
              "profile_000000000001",
          },
        ),
      ).resolves.toMatchObject({
        recordType:
          "investor-profile",
      });
    });

    it("rejects malformed ciphertext before calling KMS", async () => {
      const send =
        vi.fn();

      const cipher =
        new BusinessKmsCipher(
          config,
          client(send),
        );

      await expect(
        cipher.decrypt(
          {
            schemaVersion: 1,
            classification:
              "restricted",
            recordType:
              "banking-instrument",
            ciphertext:
              "not base64",
          },
          {
            ownerPartitionKey:
              OWNER_ONE,
            recordType:
              "banking-instrument",
            recordId:
              "bank_000000000001",
          },
        ),
      ).rejects.toThrow(
        "canonical non-empty base64",
      );

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it("propagates a wrong-context decryption failure without fallback plaintext", async () => {
      const failure =
        Object.assign(
          new Error(
            "ciphertext context mismatch",
          ),
          {
            name:
              "InvalidCiphertextException",
          },
        );

      const send =
        vi.fn().mockRejectedValue(
          failure,
        );

      const cipher =
        new BusinessKmsCipher(
          config,
          client(send),
        );

      await expect(
        cipher.decrypt(
          createBusinessEncryptedValue(
            "banking-instrument",
            "AQIDBAUGBwg=",
          ),
          {
            ownerPartitionKey:
              OWNER_TWO,
            recordType:
              "banking-instrument",
            recordId:
              "bank_000000000001",
          },
        ),
      ).rejects.toBe(
        failure,
      );

      expect(
        send,
      ).toHaveBeenCalledTimes(1);
    });

    it.each([
      "AccessDeniedException",
      "ThrottlingException",
    ])(
      "fails closed when KMS returns %s",
      async (name) => {
        const failure =
          Object.assign(
            new Error(
              "sensitive provider detail",
            ),
            {
              name,
            },
          );

        const send =
          vi.fn().mockRejectedValue(
            failure,
          );

        const cipher =
          new BusinessKmsCipher(
            config,
            client(send),
          );

        await expect(
          cipher.encrypt(
            '{"givenName":"Ada"}',
            {
              ownerPartitionKey:
                OWNER_ONE,
              recordType:
                "investor-profile",
              recordId:
                "profile_000000000001",
            },
          ),
        ).rejects.toBe(
          failure,
        );
      },
    );

    it("rejects missing KMS response payloads", async () => {
      const encryptSend =
        vi.fn().mockResolvedValue(
          {},
        );

      const decryptSend =
        vi.fn().mockResolvedValue(
          {},
        );

      await expect(
        new BusinessKmsCipher(
          config,
          client(encryptSend),
        ).encrypt(
          '{"givenName":"Ada"}',
          {
            ownerPartitionKey:
              OWNER_ONE,
            recordType:
              "investor-profile",
            recordId:
              "profile_000000000001",
          },
        ),
      ).rejects.toThrow(
        "KMS did not return business ciphertext.",
      );

      await expect(
        new BusinessKmsCipher(
          config,
          client(decryptSend),
        ).decrypt(
          createBusinessEncryptedValue(
            "investor-profile",
            "AQIDBAUGBwg=",
          ),
          {
            ownerPartitionKey:
              OWNER_ONE,
            recordType:
              "investor-profile",
            recordId:
              "profile_000000000001",
          },
        ),
      ).rejects.toThrow(
        "KMS did not return business plaintext.",
      );
    });

    it.each([
      {
        region: "",
        kmsKeyId:
          config.kmsKeyId,
      },
      {
        region:
          " us-east-1",
        kmsKeyId:
          config.kmsKeyId,
      },
      {
        region:
          config.region,
        kmsKeyId: "",
      },
      {
        region:
          config.region,
        kmsKeyId:
          `${config.kmsKeyId} `,
      },
    ])(
      "rejects malformed business KMS configuration",
      (invalidConfig) => {
        expect(() =>
          new BusinessKmsCipher(
            invalidConfig,
            client(
              vi.fn(),
            ),
          ),
        ).toThrow(
          "Business KMS configuration is invalid.",
        );
      },
    );
  },
);
