import { createHash } from "node:crypto";
import {
  BUSINESS_RETENTION_POLICY_VERSION,
} from "./business-retention-lifecycle.js";
import {
  BUSINESS_SENSITIVE_RECORD_TYPES,
  type BusinessSensitiveRecordType,
} from "./business-data-protection.js";

export const BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION =
  1 as const;

export const BUSINESS_DELETION_TOPOLOGY_VERSION =
  1 as const;

export const BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION =
  1 as const;

export const DYNAMODB_TRANSACTION_ACTION_LIMIT =
  100 as const;

export const DYNAMODB_TRANSACTION_BYTE_LIMIT =
  4 * 1024 * 1024;

export const BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS =
  2 as const;

export const MAX_ATOMIC_BUSINESS_COMPONENT_DELETIONS =
  DYNAMODB_TRANSACTION_ACTION_LIMIT -
  BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS;

export const BUSINESS_DELETION_TRANSACTION_CONTROL_BYTE_RESERVE =
  8 * 1024;

export const BUSINESS_DELETION_COMPONENT_BYTE_BUDGET =
  DYNAMODB_TRANSACTION_BYTE_LIMIT -
  BUSINESS_DELETION_TRANSACTION_CONTROL_BYTE_RESERVE;

export const BUSINESS_DELETION_CONTROL_RETENTION_DAYS =
  90 as const;

export const BUSINESS_DELETION_COMPONENT_ROLES =
  Object.freeze([
    "ciphertext-primary",
    "primary-index",
    "derived-index",
    "external-copy-reference",
  ] as const);

export type BusinessDeletionComponentRole =
  (typeof BUSINESS_DELETION_COMPONENT_ROLES)[number];

export const BUSINESS_DELETION_EXTERNAL_SYSTEM_ROLES =
  Object.freeze([
    "object-store",
    "document-store",
    "provider",
  ] as const);

export type BusinessDeletionExternalSystemRole =
  (typeof BUSINESS_DELETION_EXTERNAL_SYSTEM_ROLES)[number];

export interface BusinessDeletionDynamoDbLocator {
  readonly system:
    "dynamodb";
  readonly tableRole:
    "business-table";
  readonly awsAccountId:
    string;
  readonly awsRegion:
    string;
  readonly partitionKey:
    string;
  readonly sortKey:
    string;
  readonly estimatedItemBytes:
    number;
}

export interface BusinessDeletionExternalLocator {
  readonly system:
    "external-copy";
  readonly systemRole:
    BusinessDeletionExternalSystemRole;
  readonly referenceDigest:
    string;
}

export type BusinessDeletionComponentLocator =
  | BusinessDeletionDynamoDbLocator
  | BusinessDeletionExternalLocator;

export interface BusinessDeletionComponentInput {
  readonly componentId:
    string;
  readonly role:
    BusinessDeletionComponentRole;
  readonly locator:
    BusinessDeletionComponentLocator;
}

export interface BusinessDeletionComponent {
  readonly componentId:
    string;
  readonly role:
    BusinessDeletionComponentRole;
  readonly locator:
    BusinessDeletionComponentLocator;
  readonly locatorDigest:
    string;
}

export interface BusinessDeletionLegalHoldSnapshot {
  readonly status:
    | "inactive"
    | "active";
  readonly authority:
    "compliance-control";
  readonly version:
    number;
  readonly observedAt:
    string;
  readonly evidenceReferenceHash:
    string;
}

export interface BusinessDeletionManifestInput {
  readonly operationId:
    string;
  readonly authorizedOwnerPartitionKey:
    string;
  readonly targetOwnerPartitionKey:
    string;
  readonly recordType:
    BusinessSensitiveRecordType;
  readonly recordContextDigest:
    string;
  readonly policyVersion:
    typeof BUSINESS_RETENTION_POLICY_VERSION;
  readonly topologyVersion:
    typeof BUSINESS_DELETION_TOPOLOGY_VERSION;
  readonly idempotencyKeyDigest:
    string;
  readonly legalHoldSnapshot:
    BusinessDeletionLegalHoldSnapshot;
  readonly createdAt:
    string;
  readonly components:
    readonly BusinessDeletionComponentInput[];
}

export interface BusinessDeletionManifest {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION;
  readonly operationId:
    string;
  readonly ownerContextDigest:
    string;
  readonly recordType:
    BusinessSensitiveRecordType;
  readonly recordContextDigest:
    string;
  readonly policyVersion:
    typeof BUSINESS_RETENTION_POLICY_VERSION;
  readonly topologyVersion:
    typeof BUSINESS_DELETION_TOPOLOGY_VERSION;
  readonly idempotencyKeyDigest:
    string;
  readonly legalHoldSnapshot:
    BusinessDeletionLegalHoldSnapshot;
  readonly createdAt:
    string;
  readonly expectedComponentCount:
    number;
  readonly components:
    readonly BusinessDeletionComponent[];
  readonly manifestIntegrityDigest:
    string;
}

export type BusinessDeletionExecutionReason =
  | "active-legal-hold"
  | "component-count"
  | "aggregate-byte-budget"
  | "multiple-aws-boundaries"
  | "external-copy";

export interface BusinessDeletionDynamoDbStep {
  readonly stepId:
    string;
  readonly kind:
    "dynamodb-transaction";
  readonly awsAccountId:
    string;
  readonly awsRegion:
    string;
  readonly componentIds:
    readonly string[];
  readonly componentDeleteCount:
    number;
  readonly transactionActionCount:
    number;
  readonly estimatedItemBytes:
    number;
  readonly requiredLegalHoldVersion:
    number;
}

export interface BusinessDeletionExternalStep {
  readonly stepId:
    string;
  readonly kind:
    "external-verified-step";
  readonly systemRole:
    BusinessDeletionExternalSystemRole;
  readonly componentIds:
    readonly [string];
  readonly requiredLegalHoldVersion:
    number;
}

export type BusinessDeletionExecutionStep =
  | BusinessDeletionDynamoDbStep
  | BusinessDeletionExternalStep;

export type BusinessDeletionExecutionPlan =
  | Readonly<{
      mode:
        "blocked-legal-hold";
      operationId:
        string;
      manifestIntegrityDigest:
        string;
      expectedComponentCount:
        number;
      reasons:
        readonly ["active-legal-hold"];
      steps:
        readonly [];
    }>
  | Readonly<{
      mode:
        "atomic-single-transaction";
      operationId:
        string;
      manifestIntegrityDigest:
        string;
      expectedComponentCount:
        number;
      reasons:
        readonly [];
      steps:
        readonly [BusinessDeletionDynamoDbStep];
    }>
  | Readonly<{
      mode:
        "resumable-chunks";
      operationId:
        string;
      manifestIntegrityDigest:
        string;
      expectedComponentCount:
        number;
      reasons:
        readonly BusinessDeletionExecutionReason[];
      steps:
        readonly BusinessDeletionExecutionStep[];
    }>;

export interface BusinessDeletionExecutionProgress {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION;
  readonly operationId:
    string;
  readonly manifestIntegrityDigest:
    string;
  readonly idempotencyKeyDigest:
    string;
  readonly state:
    | "planned"
    | "in-progress"
    | "completed";
  readonly completedComponentIds:
    readonly string[];
  readonly updatedAt:
    string;
  readonly completedAt?:
    string;
}

export interface BusinessDeletionCompletionEvidence {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION;
  readonly operationId:
    string;
  readonly policyVersion:
    typeof BUSINESS_RETENTION_POLICY_VERSION;
  readonly topologyVersion:
    typeof BUSINESS_DELETION_TOPOLOGY_VERSION;
  readonly manifestIntegrityDigest:
    string;
  readonly expectedComponentCount:
    number;
  readonly deletedComponentCount:
    number;
  readonly completedAt:
    string;
  readonly outcome:
    "active-store-components-deleted";
  readonly backupDisclosureVersion:
    typeof BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION;
  readonly backupDisclosure:
    "active-store-only-pitr-backups-and-exports-may-retain-until-expiry";
}

const OWNER_PARTITION_PATTERN =
  /^BUSINESS#OWNER#[A-Za-z0-9_-]{43}$/;

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const COMPONENT_ID_PATTERN =
  /^[a-z0-9][a-z0-9_-]{2,63}$/;

const AWS_ACCOUNT_ID_PATTERN =
  /^[0-9]{12}$/;

const AWS_REGION_PATTERN =
  /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/;

const KEY_PATTERN =
  /^[^\u0000-\u001F\u007F]{1,1024}$/;

const MAX_DYNAMODB_ITEM_BYTES =
  400 * 1024;

const MAX_MANIFEST_COMPONENTS =
  10_000;

const ROLE_ORDER:
  Readonly<Record<
    BusinessDeletionComponentRole,
    number
  >> = Object.freeze({
    "ciphertext-primary": 0,
    "primary-index": 1,
    "derived-index": 2,
    "external-copy-reference": 3,
  });

function sha256(
  value:
    string,
): string {
  return createHash("sha256")
    .update(
      value,
      "utf8",
    )
    .digest("hex");
}

function canonicalTimestamp(
  value:
    string,
  name:
    string,
): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value
  ) {
    throw new Error(
      `${name} must be a canonical UTC timestamp.`,
    );
  }

  const parsed =
    Date.parse(value);

  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value
  ) {
    throw new Error(
      `${name} must be a canonical UTC timestamp.`,
    );
  }

  return value;
}

function canonicalDigest(
  value:
    string,
  name:
    string,
): string {
  if (
    typeof value !== "string" ||
    !SHA256_PATTERN.test(value)
  ) {
    throw new Error(
      `${name} must be a lowercase SHA-256 digest.`,
    );
  }

  return value;
}

function canonicalOperationId(
  value:
    string,
): string {
  if (
    typeof value !== "string" ||
    !UUID_V4_PATTERN.test(value)
  ) {
    throw new Error(
      "Deletion operation ID must be a canonical lowercase UUID v4.",
    );
  }

  return value;
}

function canonicalOwnerPartition(
  value:
    string,
  name:
    string,
): string {
  if (
    typeof value !== "string" ||
    !OWNER_PARTITION_PATTERN.test(value)
  ) {
    throw new Error(
      `${name} must be a canonical pseudonymous owner partition.`,
    );
  }

  return value;
}

function canonicalComponentId(
  value:
    string,
): string {
  if (
    typeof value !== "string" ||
    !COMPONENT_ID_PATTERN.test(value)
  ) {
    throw new Error(
      "Deletion component ID is invalid.",
    );
  }

  return value;
}

function canonicalKey(
  value:
    string,
  name:
    string,
): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !KEY_PATTERN.test(value)
  ) {
    throw new Error(
      `${name} is invalid.`,
    );
  }

  return value;
}

function canonicalPositiveInteger(
  value:
    number,
  name:
    string,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `${name} must be a positive safe integer.`,
    );
  }

  return value;
}

function isSensitiveRecordType(
  value:
    string,
): value is BusinessSensitiveRecordType {
  return (
    BUSINESS_SENSITIVE_RECORD_TYPES as
      readonly string[]
  ).includes(value);
}

function validatedLegalHoldSnapshot(
  input:
    BusinessDeletionLegalHoldSnapshot,
  createdAt:
    string,
): BusinessDeletionLegalHoldSnapshot {
  if (
    input.status !== "inactive" &&
    input.status !== "active"
  ) {
    throw new Error(
      "Legal-hold snapshot status is unsupported.",
    );
  }

  if (
    input.authority !==
    "compliance-control"
  ) {
    throw new Error(
      "Legal-hold snapshot authority is unsupported.",
    );
  }

  const version =
    canonicalPositiveInteger(
      input.version,
      "Legal-hold version",
    );

  const observedAt =
    canonicalTimestamp(
      input.observedAt,
      "Legal-hold observation time",
    );

  if (
    Date.parse(observedAt) >
    Date.parse(createdAt)
  ) {
    throw new Error(
      "Legal-hold observation cannot follow manifest creation.",
    );
  }

  return Object.freeze({
    status:
      input.status,
    authority:
      input.authority,
    version,
    observedAt,
    evidenceReferenceHash:
      canonicalDigest(
        input.evidenceReferenceHash,
        "Legal-hold evidence",
      ),
  });
}

function validatedDynamoDbLocator(
  input:
    BusinessDeletionDynamoDbLocator,
): BusinessDeletionDynamoDbLocator {
  if (
    input.tableRole !==
    "business-table"
  ) {
    throw new Error(
      "DynamoDB deletion table role is unsupported.",
    );
  }

  if (
    !AWS_ACCOUNT_ID_PATTERN.test(
      input.awsAccountId,
    )
  ) {
    throw new Error(
      "DynamoDB locator AWS account ID is invalid.",
    );
  }

  if (
    !AWS_REGION_PATTERN.test(
      input.awsRegion,
    )
  ) {
    throw new Error(
      "DynamoDB locator AWS Region is invalid.",
    );
  }

  const estimatedItemBytes =
    canonicalPositiveInteger(
      input.estimatedItemBytes,
      "Estimated DynamoDB item bytes",
    );

  if (
    estimatedItemBytes >
    MAX_DYNAMODB_ITEM_BYTES
  ) {
    throw new Error(
      "Estimated DynamoDB item bytes exceed the supported item limit.",
    );
  }

  return Object.freeze({
    system:
      "dynamodb",
    tableRole:
      input.tableRole,
    awsAccountId:
      input.awsAccountId,
    awsRegion:
      input.awsRegion,
    partitionKey:
      canonicalKey(
        input.partitionKey,
        "DynamoDB partition key",
      ),
    sortKey:
      canonicalKey(
        input.sortKey,
        "DynamoDB sort key",
      ),
    estimatedItemBytes,
  });
}

function validatedExternalLocator(
  input:
    BusinessDeletionExternalLocator,
): BusinessDeletionExternalLocator {
  if (
    !(
      BUSINESS_DELETION_EXTERNAL_SYSTEM_ROLES as
        readonly string[]
    ).includes(input.systemRole)
  ) {
    throw new Error(
      "External deletion system role is unsupported.",
    );
  }

  return Object.freeze({
    system:
      "external-copy",
    systemRole:
      input.systemRole,
    referenceDigest:
      canonicalDigest(
        input.referenceDigest,
        "External copy reference",
      ),
  });
}

function locatorCanonicalValue(
  locator:
    BusinessDeletionComponentLocator,
): string {
  if (
    locator.system ===
    "dynamodb"
  ) {
    return [
      locator.system,
      locator.tableRole,
      locator.awsAccountId,
      locator.awsRegion,
      locator.partitionKey,
      locator.sortKey,
    ].join("\u001F");
  }

  return [
    locator.system,
    locator.systemRole,
    locator.referenceDigest,
  ].join("\u001F");
}

function validatedComponent(
  input:
    BusinessDeletionComponentInput,
): BusinessDeletionComponent {
  if (
    !(
      BUSINESS_DELETION_COMPONENT_ROLES as
        readonly string[]
    ).includes(input.role)
  ) {
    throw new Error(
      "Deletion component role is unsupported.",
    );
  }

  const componentId =
    canonicalComponentId(
      input.componentId,
    );

  if (
    input.role ===
    "external-copy-reference"
  ) {
    if (
      input.locator.system !==
      "external-copy"
    ) {
      throw new Error(
        "External-copy components require an external locator.",
      );
    }

    const locator =
      validatedExternalLocator(
        input.locator,
      );

    return Object.freeze({
      componentId,
      role:
        input.role,
      locator,
      locatorDigest:
        sha256(
          locatorCanonicalValue(
            locator,
          ),
        ),
    });
  }

  if (
    input.locator.system !==
    "dynamodb"
  ) {
    throw new Error(
      "DynamoDB deletion components require a DynamoDB locator.",
    );
  }

  const locator =
    validatedDynamoDbLocator(
      input.locator,
    );

  return Object.freeze({
    componentId,
    role:
      input.role,
    locator,
    locatorDigest:
      sha256(
        locatorCanonicalValue(
          locator,
        ),
      ),
  });
}

function componentCanonicalValue(
  component:
    BusinessDeletionComponent,
): string {
  return [
    String(
      ROLE_ORDER[
        component.role
      ],
    ),
    component.role,
    component.componentId,
    component.locatorDigest,
    component.locator.system === "dynamodb"
      ? String(component.locator.estimatedItemBytes)
      : "",
  ].join("\u001E");
}

function frozenComponents(
  input:
    readonly BusinessDeletionComponentInput[],
): readonly BusinessDeletionComponent[] {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length >
    MAX_MANIFEST_COMPONENTS
  ) {
    throw new Error(
      "Deletion manifest component count is invalid.",
    );
  }

  const components =
    input
      .map(validatedComponent)
      .sort(
        (
          left,
          right,
        ) =>
          componentCanonicalValue(
            left,
          ).localeCompare(
            componentCanonicalValue(
              right,
          ),
          ),
      );

  const componentIds =
    new Set<string>();

  const locatorDigests =
    new Set<string>();

  let ciphertextPrimaryCount =
    0;

  for (
    const component of
    components
  ) {
    if (
      componentIds.has(
        component.componentId,
      )
    ) {
      throw new Error(
        "Deletion manifest component IDs must be unique.",
      );
    }

    componentIds.add(
      component.componentId,
    );

    if (
      locatorDigests.has(
        component.locatorDigest,
      )
    ) {
      throw new Error(
        "Deletion manifest locators must target distinct components.",
      );
    }

    locatorDigests.add(
      component.locatorDigest,
    );

    if (
      component.role ===
      "ciphertext-primary"
    ) {
      ciphertextPrimaryCount++;
    }
  }

  if (
    ciphertextPrimaryCount !== 1
  ) {
    throw new Error(
      "Deletion manifest requires exactly one ciphertext-primary component.",
    );
  }

  return Object.freeze([
    ...components,
  ]);
}

function manifestCanonicalValue(
  input:
    Omit<
      BusinessDeletionManifest,
      "manifestIntegrityDigest"
    >,
): string {
  const legalHold =
    input.legalHoldSnapshot;

  return [
    String(
      input.schemaVersion,
    ),
    input.operationId,
    input.ownerContextDigest,
    input.recordType,
    input.recordContextDigest,
    String(
      input.policyVersion,
    ),
    String(
      input.topologyVersion,
    ),
    input.idempotencyKeyDigest,
    legalHold.status,
    legalHold.authority,
    String(
      legalHold.version,
    ),
    legalHold.observedAt,
    legalHold.evidenceReferenceHash,
    input.createdAt,
    String(
      input.expectedComponentCount,
    ),
    ...input.components.map(
      componentCanonicalValue,
    ),
  ].join("\u001D");
}

export function createBusinessDeletionManifest(
  input:
    BusinessDeletionManifestInput,
): BusinessDeletionManifest {
  const operationId =
    canonicalOperationId(
      input.operationId,
    );

  const authorizedOwnerPartitionKey =
    canonicalOwnerPartition(
      input.authorizedOwnerPartitionKey,
      "Authorized owner partition",
    );

  const targetOwnerPartitionKey =
    canonicalOwnerPartition(
      input.targetOwnerPartitionKey,
      "Target owner partition",
    );

  if (
    authorizedOwnerPartitionKey !==
    targetOwnerPartitionKey
  ) {
    throw new Error(
      "Deletion manifest owner scope does not match the server-derived authorization scope.",
    );
  }

  if (
    !isSensitiveRecordType(
      input.recordType,
    )
  ) {
    throw new Error(
      "Deletion manifest record type is unsupported.",
    );
  }

  if (
    input.policyVersion !==
    BUSINESS_RETENTION_POLICY_VERSION
  ) {
    throw new Error(
      "Deletion manifest policy version is unsupported.",
    );
  }

  if (
    input.topologyVersion !==
    BUSINESS_DELETION_TOPOLOGY_VERSION
  ) {
    throw new Error(
      "Deletion manifest topology version is unsupported.",
    );
  }

  const createdAt =
    canonicalTimestamp(
      input.createdAt,
      "Deletion manifest creation time",
    );

  const components =
    frozenComponents(
      input.components,
    );

  const unsigned =
    Object.freeze({
      schemaVersion:
        BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
      operationId,
      ownerContextDigest:
        sha256(
          authorizedOwnerPartitionKey,
        ),
      recordType:
        input.recordType,
      recordContextDigest:
        canonicalDigest(
          input.recordContextDigest,
          "Record context",
        ),
      policyVersion:
        input.policyVersion,
      topologyVersion:
        input.topologyVersion,
      idempotencyKeyDigest:
        canonicalDigest(
          input.idempotencyKeyDigest,
          "Deletion idempotency key",
        ),
      legalHoldSnapshot:
        validatedLegalHoldSnapshot(
          input.legalHoldSnapshot,
          createdAt,
        ),
      createdAt,
      expectedComponentCount:
        components.length,
      components,
    });

  return Object.freeze({
    ...unsigned,
    manifestIntegrityDigest:
      sha256(
        manifestCanonicalValue(
          unsigned,
        ),
      ),
  });
}

function frozenStrings(
  values:
    readonly string[],
): readonly string[] {
  return Object.freeze([
    ...values,
  ]);
}

function dynamoStep(
  index:
    number,
  components:
    readonly BusinessDeletionComponent[],
  legalHoldVersion:
    number,
): BusinessDeletionDynamoDbStep {
  if (
    components.length < 1
  ) {
    throw new Error(
      "A DynamoDB deletion step cannot be empty.",
    );
  }

  const first =
    components[0];

  if (
    !first ||
    first.locator.system !==
    "dynamodb"
  ) {
    throw new Error(
      "A DynamoDB deletion step requires DynamoDB components.",
    );
  }

  let estimatedItemBytes =
    0;

  for (
    const component of
    components
  ) {
    if (
      component.locator.system !==
      "dynamodb" ||
      component.locator.awsAccountId !==
      first.locator.awsAccountId ||
      component.locator.awsRegion !==
      first.locator.awsRegion
    ) {
      throw new Error(
        "A DynamoDB deletion step cannot cross an AWS account or Region boundary.",
      );
    }

    estimatedItemBytes +=
      component.locator
        .estimatedItemBytes;
  }

  return Object.freeze({
    stepId:
      `step-${String(index).padStart(4, "0")}`,
    kind:
      "dynamodb-transaction",
    awsAccountId:
      first.locator.awsAccountId,
    awsRegion:
      first.locator.awsRegion,
    componentIds:
      frozenStrings(
        components.map(
          (component) =>
            component.componentId,
        ),
      ),
    componentDeleteCount:
      components.length,
    transactionActionCount:
      components.length +
      BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS,
    estimatedItemBytes,
    requiredLegalHoldVersion:
      legalHoldVersion,
  });
}

function externalStep(
  index:
    number,
  component:
    BusinessDeletionComponent,
  legalHoldVersion:
    number,
): BusinessDeletionExternalStep {
  if (
    component.locator.system !==
    "external-copy"
  ) {
    throw new Error(
      "An external deletion step requires an external component.",
    );
  }

  return Object.freeze({
    stepId:
      `step-${String(index).padStart(4, "0")}`,
    kind:
      "external-verified-step",
    systemRole:
      component.locator.systemRole,
    componentIds:
      Object.freeze([
        component.componentId,
      ]) as readonly [string],
    requiredLegalHoldVersion:
      legalHoldVersion,
  });
}

function resumableReasons(
  manifest:
    BusinessDeletionManifest,
): readonly BusinessDeletionExecutionReason[] {
  const dynamoComponents =
    manifest.components.filter(
      (
        component,
      ): component is
        BusinessDeletionComponent & {
          readonly locator:
            BusinessDeletionDynamoDbLocator;
        } =>
        component.locator.system ===
        "dynamodb",
    );

  const boundaries =
    new Set(
      dynamoComponents.map(
        (component) =>
          [
            component.locator
              .awsAccountId,
            component.locator
              .awsRegion,
          ].join(":"),
      ),
    );

  const totalBytes =
    dynamoComponents.reduce(
      (
        sum,
        component,
      ) =>
        sum +
        component.locator
          .estimatedItemBytes,
      0,
    );

  const reasons:
    BusinessDeletionExecutionReason[] = [];

  if (
    manifest.components.some(
      (component) =>
        component.locator.system ===
        "external-copy",
    )
  ) {
    reasons.push(
      "external-copy",
    );
  }

  if (
    dynamoComponents.length >
    MAX_ATOMIC_BUSINESS_COMPONENT_DELETIONS
  ) {
    reasons.push(
      "component-count",
    );
  }

  if (
    totalBytes >
    BUSINESS_DELETION_COMPONENT_BYTE_BUDGET
  ) {
    reasons.push(
      "aggregate-byte-budget",
    );
  }

  if (
    boundaries.size >
    1
  ) {
    reasons.push(
      "multiple-aws-boundaries",
    );
  }

  return Object.freeze(
    reasons,
  );
}

function resumableSteps(
  manifest:
    BusinessDeletionManifest,
): readonly BusinessDeletionExecutionStep[] {
  const groups =
    new Map<
      string,
      BusinessDeletionComponent[]
    >();

  const external:
    BusinessDeletionComponent[] = [];

  for (
    const component of
    manifest.components
  ) {
    if (
      component.locator.system ===
      "external-copy"
    ) {
      external.push(
        component,
      );

      continue;
    }

    const boundary =
      [
        component.locator
          .awsAccountId,
        component.locator
          .awsRegion,
      ].join(":");

    const group =
      groups.get(
        boundary,
      ) ?? [];

    group.push(
      component,
    );

    groups.set(
      boundary,
      group,
    );
  }

  const steps:
    BusinessDeletionExecutionStep[] = [];

  let stepIndex =
    1;

  for (
    const boundary of
    [...groups.keys()].sort()
  ) {
    const group =
      groups.get(
        boundary,
      );

    if (!group) {
      throw new Error(
        "Deletion execution group is missing.",
      );
    }

    let chunk:
      BusinessDeletionComponent[] = [];

    let chunkBytes =
      0;

    const flush = () => {
      if (
        chunk.length < 1
      ) {
        return;
      }

      steps.push(
        dynamoStep(
          stepIndex++,
          chunk,
          manifest
            .legalHoldSnapshot
            .version,
        ),
      );

      chunk = [];
      chunkBytes = 0;
    };

    for (
      const component of
      group
    ) {
      if (
        component.locator.system !==
        "dynamodb"
      ) {
        throw new Error(
          "Deletion execution group contains a non-DynamoDB component.",
        );
      }

      const bytes =
        component.locator
          .estimatedItemBytes;

      if (
        bytes >
        BUSINESS_DELETION_COMPONENT_BYTE_BUDGET
      ) {
        throw new Error(
          "A deletion component exceeds the transaction byte budget.",
        );
      }

      if (
        chunk.length >=
          MAX_ATOMIC_BUSINESS_COMPONENT_DELETIONS ||
        chunkBytes + bytes >
          BUSINESS_DELETION_COMPONENT_BYTE_BUDGET
      ) {
        flush();
      }

      chunk.push(
        component,
      );

      chunkBytes +=
        bytes;
    }

    flush();
  }

  for (
    const component of
    external
  ) {
    steps.push(
      externalStep(
        stepIndex++,
        component,
        manifest
          .legalHoldSnapshot
          .version,
      ),
    );
  }

  return Object.freeze([
    ...steps,
  ]);
}

export function planBusinessDeletionExecution(
  manifest:
    BusinessDeletionManifest,
): BusinessDeletionExecutionPlan {
  if (
    manifest.legalHoldSnapshot
      .status ===
    "active"
  ) {
    return Object.freeze({
      mode:
        "blocked-legal-hold",
      operationId:
        manifest.operationId,
      manifestIntegrityDigest:
        manifest
          .manifestIntegrityDigest,
      expectedComponentCount:
        manifest
          .expectedComponentCount,
      reasons:
        Object.freeze([
          "active-legal-hold",
        ]) as readonly [
          "active-legal-hold",
        ],
      steps:
        Object.freeze(
          [],
        ) as readonly [],
    });
  }

  const reasons =
    resumableReasons(
      manifest,
    );

  if (
    reasons.length === 0
  ) {
    const step =
      dynamoStep(
        1,
        manifest.components,
        manifest
          .legalHoldSnapshot
          .version,
      );

    return Object.freeze({
      mode:
        "atomic-single-transaction",
      operationId:
        manifest.operationId,
      manifestIntegrityDigest:
        manifest
          .manifestIntegrityDigest,
      expectedComponentCount:
        manifest
          .expectedComponentCount,
      reasons:
        Object.freeze(
          [],
        ) as readonly [],
      steps:
        Object.freeze([
          step,
        ]) as readonly [
          BusinessDeletionDynamoDbStep,
        ],
    });
  }

  return Object.freeze({
    mode:
      "resumable-chunks",
    operationId:
      manifest.operationId,
    manifestIntegrityDigest:
      manifest
        .manifestIntegrityDigest,
    expectedComponentCount:
      manifest
        .expectedComponentCount,
    reasons,
    steps:
      resumableSteps(
        manifest,
      ),
  });
}

function assertInactiveLegalHold(
  manifest:
    BusinessDeletionManifest,
): void {
  if (
    manifest.legalHoldSnapshot
      .status !==
    "inactive"
  ) {
    throw new Error(
      "Deletion execution cannot progress under an active legal hold.",
    );
  }
}

function validateProgressBinding(
  manifest:
    BusinessDeletionManifest,
  progress:
    BusinessDeletionExecutionProgress,
): void {
  if (
    progress.schemaVersion !==
      BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION ||
    progress.operationId !==
      manifest.operationId ||
    progress.manifestIntegrityDigest !==
      manifest.manifestIntegrityDigest ||
    progress.idempotencyKeyDigest !==
      manifest.idempotencyKeyDigest
  ) {
    throw new Error(
      "Deletion progress does not match its manifest and idempotency binding.",
    );
  }
}

function validatedCompletedIds(
  manifest:
    BusinessDeletionManifest,
  values:
    readonly string[],
): readonly string[] {
  if (
    !Array.isArray(values)
  ) {
    throw new Error(
      "Completed deletion component IDs are invalid.",
    );
  }

  const known =
    new Set(
      manifest.components.map(
        (component) =>
          component.componentId,
      ),
    );

  const unique =
    new Set<string>();

  for (
    const value of
    values
  ) {
    const componentId =
      canonicalComponentId(
        value,
      );

    if (
      !known.has(
        componentId,
      )
    ) {
      throw new Error(
        "Deletion progress references an unknown component.",
      );
    }

    unique.add(
      componentId,
    );
  }

  return Object.freeze(
    [...unique].sort(),
  );
}

export function createBusinessDeletionExecutionProgress(
  manifest:
    BusinessDeletionManifest,
  updatedAt:
    string,
): BusinessDeletionExecutionProgress {
  assertInactiveLegalHold(
    manifest,
  );

  const timestamp =
    canonicalTimestamp(
      updatedAt,
      "Deletion progress update time",
    );

  if (
    Date.parse(timestamp) <
    Date.parse(manifest.createdAt)
  ) {
    throw new Error(
      "Deletion progress cannot precede manifest creation.",
    );
  }

  return Object.freeze({
    schemaVersion:
      BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
    operationId:
      manifest.operationId,
    manifestIntegrityDigest:
      manifest
        .manifestIntegrityDigest,
    idempotencyKeyDigest:
      manifest.idempotencyKeyDigest,
    state:
      "planned",
    completedComponentIds:
      Object.freeze(
        [],
      ),
    updatedAt:
      timestamp,
  });
}

export function recordBusinessDeletionComponentCompletion(
  manifest:
    BusinessDeletionManifest,
  current:
    BusinessDeletionExecutionProgress,
  completedComponentIds:
    readonly string[],
  updatedAt:
    string,
): BusinessDeletionExecutionProgress {
  assertInactiveLegalHold(
    manifest,
  );

  validateProgressBinding(
    manifest,
    current,
  );

  const timestamp =
    canonicalTimestamp(
      updatedAt,
      "Deletion progress update time",
    );

  if (
    Date.parse(timestamp) <
    Date.parse(current.updatedAt)
  ) {
    throw new Error(
      "Deletion progress cannot move backward in time.",
    );
  }

  const additions =
    validatedCompletedIds(
      manifest,
      completedComponentIds,
    );

  const completed =
    validatedCompletedIds(
      manifest,
      [
        ...current
          .completedComponentIds,
        ...additions,
      ],
    );

  const isComplete =
    completed.length ===
    manifest.expectedComponentCount;

  return Object.freeze({
    schemaVersion:
      BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
    operationId:
      manifest.operationId,
    manifestIntegrityDigest:
      manifest
        .manifestIntegrityDigest,
    idempotencyKeyDigest:
      manifest.idempotencyKeyDigest,
    state:
      isComplete
        ? "completed"
        : "in-progress",
    completedComponentIds:
      completed,
    updatedAt:
      timestamp,
    ...(isComplete
      ? {
          completedAt:
            timestamp,
        }
      : {}),
  });
}

export function createBusinessDeletionCompletionEvidence(
  manifest:
    BusinessDeletionManifest,
  progress:
    BusinessDeletionExecutionProgress,
): BusinessDeletionCompletionEvidence {
  assertInactiveLegalHold(
    manifest,
  );

  validateProgressBinding(
    manifest,
    progress,
  );

  if (
    progress.state !==
      "completed" ||
    !progress.completedAt ||
    progress.completedComponentIds
      .length !==
      manifest.expectedComponentCount
  ) {
    throw new Error(
      "Deletion completion evidence requires every manifest component to be verified.",
    );
  }

  const known =
    new Set(
      manifest.components.map(
        (component) =>
          component.componentId,
      ),
    );

  for (
    const componentId of
    progress.completedComponentIds
  ) {
    if (
      !known.has(
        componentId,
      )
    ) {
      throw new Error(
        "Deletion completion evidence contains an unknown component.",
      );
    }
  }

  return Object.freeze({
    schemaVersion:
      BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
    operationId:
      manifest.operationId,
    policyVersion:
      manifest.policyVersion,
    topologyVersion:
      manifest.topologyVersion,
    manifestIntegrityDigest:
      manifest
        .manifestIntegrityDigest,
    expectedComponentCount:
      manifest
        .expectedComponentCount,
    deletedComponentCount:
      progress
        .completedComponentIds
        .length,
    completedAt:
      canonicalTimestamp(
        progress.completedAt,
        "Deletion completion time",
      ),
    outcome:
      "active-store-components-deleted",
    backupDisclosureVersion:
      BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION,
    backupDisclosure:
      "active-store-only-pitr-backups-and-exports-may-retain-until-expiry",
  });
}
