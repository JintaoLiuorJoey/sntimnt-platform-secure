import { sha256 } from "./security.js";

export const BUSINESS_SENSITIVE_RECORD_TYPES = [
  "investor-profile",
  "identity-verification",
  "banking-instrument",
  "money-movement",
  "portfolio-position",
  "trade-record",
] as const;

export type BusinessSensitiveRecordType =
  (typeof BUSINESS_SENSITIVE_RECORD_TYPES)[number];

export type BusinessDataClassification =
  | "confidential"
  | "restricted";

const classificationByRecordType = Object.freeze({
  "investor-profile": "confidential",
  "identity-verification": "restricted",
  "banking-instrument": "restricted",
  "money-movement": "restricted",
  "portfolio-position": "restricted",
  "trade-record": "restricted",
} satisfies Record<
  BusinessSensitiveRecordType,
  BusinessDataClassification
>);

const OWNER_PARTITION_PATTERN =
  /^BUSINESS#OWNER#[A-Za-z0-9_-]{43}$/;

const RECORD_IDENTIFIER_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

const BASE64_CIPHERTEXT_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface BusinessEncryptionContext {
  readonly application: "sntimnt";
  readonly schema: "business-sensitive-v1";
  readonly classification: BusinessDataClassification;
  readonly recordType: BusinessSensitiveRecordType;
  readonly ownerContextHash: string;
  readonly recordContextHash: string;
}

export interface BusinessEncryptedValue {
  readonly schemaVersion: 1;
  readonly classification: BusinessDataClassification;
  readonly recordType: BusinessSensitiveRecordType;
  readonly ciphertext: string;
}

export interface BusinessEncryptionContextInput {
  readonly ownerPartitionKey: string;
  readonly recordType: BusinessSensitiveRecordType;
  readonly recordId: string;
}

export function businessDataClassification(
  recordType: BusinessSensitiveRecordType,
): BusinessDataClassification {
  return classificationByRecordType[recordType];
}

function validatedOwnerPartitionKey(value: string): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !OWNER_PARTITION_PATTERN.test(value)
  ) {
    throw new Error(
      "A canonical pseudonymous business owner partition is required.",
    );
  }

  return value;
}

function validatedRecordId(value: string): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !RECORD_IDENTIFIER_PATTERN.test(value)
  ) {
    throw new Error(
      "A canonical non-sensitive business record identifier is required.",
    );
  }

  return value;
}

export function buildBusinessEncryptionContext(
  input: BusinessEncryptionContextInput,
): BusinessEncryptionContext {
  const ownerPartitionKey =
    validatedOwnerPartitionKey(input.ownerPartitionKey);

  const recordId =
    validatedRecordId(input.recordId);

  const classification =
    businessDataClassification(input.recordType);

  return Object.freeze({
    application: "sntimnt",
    schema: "business-sensitive-v1",
    classification,
    recordType: input.recordType,
    ownerContextHash: sha256(ownerPartitionKey),
    recordContextHash: sha256(
      `${input.recordType}:${recordId}`,
    ),
  });
}

function validatedCiphertext(value: string): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 8 ||
    value.length > 16_384 ||
    value.length % 4 !== 0 ||
    !BASE64_CIPHERTEXT_PATTERN.test(value)
  ) {
    throw new Error(
      "Business ciphertext must be canonical non-empty base64.",
    );
  }

  return value;
}

export function createBusinessEncryptedValue(
  recordType: BusinessSensitiveRecordType,
  ciphertext: string,
): BusinessEncryptedValue {
  return Object.freeze({
    schemaVersion: 1,
    classification:
      businessDataClassification(recordType),
    recordType,
    ciphertext: validatedCiphertext(ciphertext),
  });
}

export function validateBusinessEncryptedValue(
  value: unknown,
  expectedRecordType: BusinessSensitiveRecordType,
): BusinessEncryptedValue {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "Encrypted business value is malformed.",
    );
  }

  const candidate =
    value as Partial<BusinessEncryptedValue>;

  const expectedClassification =
    businessDataClassification(expectedRecordType);

  if (
    candidate.schemaVersion !== 1 ||
    candidate.recordType !== expectedRecordType ||
    candidate.classification !== expectedClassification ||
    typeof candidate.ciphertext !== "string"
  ) {
    throw new Error(
      "Encrypted business value does not match its expected contract.",
    );
  }

  return createBusinessEncryptedValue(
    expectedRecordType,
    candidate.ciphertext,
  );
}
