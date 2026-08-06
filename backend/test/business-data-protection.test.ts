import {
  describe,
  expect,
  it,
} from "vitest";
import {
  BUSINESS_SENSITIVE_RECORD_TYPES,
  buildBusinessEncryptionContext,
  businessDataClassification,
  createBusinessEncryptedValue,
  validateBusinessEncryptedValue,
} from "../src/business-data-protection.js";

const OWNER_ONE =
  "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const OWNER_TWO =
  "BUSINESS#OWNER#BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

describe("business sensitive-data protection contract", () => {
  it("classifies every supported sensitive record type", () => {
    expect(BUSINESS_SENSITIVE_RECORD_TYPES).toEqual([
      "investor-profile",
      "identity-verification",
      "banking-instrument",
      "money-movement",
      "portfolio-position",
      "trade-record",
    ]);

    expect(
      businessDataClassification(
        "investor-profile",
      ),
    ).toBe("confidential");

    for (
      const recordType of
      BUSINESS_SENSITIVE_RECORD_TYPES.slice(1)
    ) {
      expect(
        businessDataClassification(recordType),
      ).toBe("restricted");
    }
  });

  it("builds a frozen context containing only pseudonymous hashes", () => {
    const context =
      buildBusinessEncryptionContext({
        ownerPartitionKey: OWNER_ONE,
        recordType: "banking-instrument",
        recordId: "bank_000000000001",
      });

    expect(context).toMatchObject({
      application: "sntimnt",
      schema: "business-sensitive-v1",
      classification: "restricted",
      recordType: "banking-instrument",
    });

    expect(context.ownerContextHash).not.toBe(OWNER_ONE);
    expect(context.recordContextHash).not.toContain(
      "bank_000000000001",
    );
    expect(JSON.stringify(context)).not.toContain(
      OWNER_ONE,
    );
    expect(Object.isFrozen(context)).toBe(true);
  });

  it("binds context hashes to both owner and record identity", () => {
    const first =
      buildBusinessEncryptionContext({
        ownerPartitionKey: OWNER_ONE,
        recordType: "money-movement",
        recordId: "movement_000000000001",
      });

    const differentOwner =
      buildBusinessEncryptionContext({
        ownerPartitionKey: OWNER_TWO,
        recordType: "money-movement",
        recordId: "movement_000000000001",
      });

    const differentRecord =
      buildBusinessEncryptionContext({
        ownerPartitionKey: OWNER_ONE,
        recordType: "money-movement",
        recordId: "movement_000000000002",
      });

    expect(
      differentOwner.ownerContextHash,
    ).not.toBe(first.ownerContextHash);

    expect(
      differentRecord.recordContextHash,
    ).not.toBe(first.recordContextHash);
  });

  it.each([
    "",
    "raw-cognito-subject",
    " BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "BUSINESS#OWNER#not-a-canonical-hash",
  ])(
    "rejects a non-canonical owner partition: %s",
    (ownerPartitionKey) => {
      expect(() =>
        buildBusinessEncryptionContext({
          ownerPartitionKey,
          recordType: "investor-profile",
          recordId: "profile_000000000001",
        }),
      ).toThrow(
        "A canonical pseudonymous business owner partition is required.",
      );
    },
  );

  it.each([
    "",
    " profile_000000000001",
    "profile@example.com",
    "profile/000000000001",
  ])(
    "rejects an unsafe record identifier: %s",
    (recordId) => {
      expect(() =>
        buildBusinessEncryptionContext({
          ownerPartitionKey: OWNER_ONE,
          recordType: "investor-profile",
          recordId,
        }),
      ).toThrow(
        "A canonical non-sensitive business record identifier is required.",
      );
    },
  );

  it("creates and validates a frozen encrypted value envelope", () => {
    const encrypted =
      createBusinessEncryptedValue(
        "identity-verification",
        "Y2lwaGVydGV4dA==",
      );

    expect(encrypted).toEqual({
      schemaVersion: 1,
      classification: "restricted",
      recordType: "identity-verification",
      ciphertext: "Y2lwaGVydGV4dA==",
    });

    expect(Object.isFrozen(encrypted)).toBe(true);

    expect(
      validateBusinessEncryptedValue(
        encrypted,
        "identity-verification",
      ),
    ).toEqual(encrypted);
  });

  it("rejects plaintext and malformed ciphertext envelopes", () => {
    expect(() =>
      createBusinessEncryptedValue(
        "banking-instrument",
        "routing-number-123456789",
      ),
    ).toThrow(
      "Business ciphertext must be canonical non-empty base64.",
    );

    expect(() =>
      validateBusinessEncryptedValue(
        {
          schemaVersion: 1,
          classification: "restricted",
          recordType: "banking-instrument",
          ciphertext: "not base64",
        },
        "banking-instrument",
      ),
    ).toThrow(
      "Business ciphertext must be canonical non-empty base64.",
    );
  });

  it("rejects an envelope used for the wrong record contract", () => {
    const encrypted =
      createBusinessEncryptedValue(
        "banking-instrument",
        "Y2lwaGVydGV4dA==",
      );

    expect(() =>
      validateBusinessEncryptedValue(
        encrypted,
        "money-movement",
      ),
    ).toThrow(
      "Encrypted business value does not match its expected contract.",
    );
  });
});
