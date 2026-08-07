import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import type {
  AttributeValue,
  GetItemCommandOutput,
} from "@aws-sdk/client-dynamodb";
import {
  BUSINESS_DELETION_CONTROL_RECORD_KINDS,
  BUSINESS_DELETION_CONTROL_STATES,
  BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
  BUSINESS_DELETION_CONTROL_STORE_RETENTION_DAYS,
  BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
  businessDeletionControlEvidenceKey,
  businessDeletionControlIdempotencyKey,
  businessDeletionControlOperationKey,
  businessDeletionControlProgressKey,
  type BusinessDeletionControlIdempotencyClaim,
  type BusinessDeletionControlKey,
  type BusinessDeletionControlLegalHoldRecord,
  type BusinessDeletionControlOperationMutationGuard,
  type BusinessDeletionControlOperationRoot,
  type BusinessDeletionControlProgressMutationGuard,
  type BusinessDeletionControlProgressRecord,
  type BusinessDeletionControlRetirementMarker,
  type BusinessDeletionControlStoreRecord,
  type BusinessDeletionControlTerminalEvidenceRecord,
} from "./business-deletion-control-store.js";

type Item =
  Record<string, AttributeValue>;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const AWS_REGION_PATTERN =
  /^[a-z]{2}(?:-[a-z0-9]+)+-\d$/;

const TABLE_NAME_PATTERN =
  /^[A-Za-z0-9_.-]{3,255}$/;

const OPERATION_PK_PREFIX =
  "DEL#OP#";

const IDEMPOTENCY_PK_PREFIX =
  "DEL#IDEM#";

const ROOT_SORT_KEY =
  "ROOT";

const IDEMPOTENCY_SORT_KEY =
  "CLAIM";

const EVIDENCE_SORT_KEY =
  "EVIDENCE";

const RETIREMENT_SORT_KEY =
  "RETIRE";

const RECORD_JSON_ATTRIBUTE =
  "recordJson";

const TTL_ATTRIBUTE =
  "ttl";

export const BUSINESS_DELETION_CONTROL_PERSISTENCE_MAX_RECORD_JSON_BYTES =
  300 * 1024;

export interface BusinessDeletionControlPersistenceConfig {
  readonly region:
    string;
  readonly tableName:
    string;
}

export class BusinessDeletionControlPersistenceConflictError
  extends Error {
  constructor() {
    super(
      "Deletion control persistence condition failed.",
    );

    this.name =
      "BusinessDeletionControlPersistenceConflictError";
  }
}

export class BusinessDeletionControlPersistenceUnavailableError
  extends Error {
  constructor() {
    super(
      "Deletion control persistence is temporarily unavailable.",
    );

    this.name =
      "BusinessDeletionControlPersistenceUnavailableError";
  }
}

export class BusinessDeletionControlPersistenceDataIntegrityError
  extends Error {
  constructor() {
    super(
      "Deletion control persistence data failed validation.",
    );

    this.name =
      "BusinessDeletionControlPersistenceDataIntegrityError";
  }
}

function canonicalOperationId(
  value:
    unknown,
): string {
  if (
    typeof value !== "string" ||
    !UUID_V4_PATTERN.test(value)
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value;
}

function canonicalDigest(
  value:
    unknown,
): string {
  if (
    typeof value !== "string" ||
    !SHA256_PATTERN.test(value)
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value;
}

function canonicalPositiveInteger(
  value:
    unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value;
}

function canonicalNonNegativeInteger(
  value:
    unknown,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value;
}

function canonicalTimestamp(
  value:
    unknown,
): string {
  if (
    typeof value !== "string"
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  const parsed =
    Date.parse(value);

  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value;
}

function objectRecord(
  value:
    unknown,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value as
    Record<string, unknown>;
}

function assertExactKeys(
  value:
    Record<string, unknown>,
  required:
    readonly string[],
  optional:
    readonly string[] = [],
): void {
  const allowed =
    new Set([
      ...required,
      ...optional,
    ]);

  for (
    const key of
    Object.keys(value)
  ) {
    if (!allowed.has(key)) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }
  }

  for (const key of required) {
    if (!(key in value)) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }
  }
}

function canonicalString(
  value:
    unknown,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value;
}

function canonicalControlState(
  value:
    unknown,
): BusinessDeletionControlOperationRoot["state"] {
  if (
    typeof value !== "string" ||
    !(
      BUSINESS_DELETION_CONTROL_STATES as
        readonly string[]
    ).includes(value)
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value as
    BusinessDeletionControlOperationRoot["state"];
}

function canonicalProgressState(
  value:
    unknown,
): BusinessDeletionControlProgressRecord["state"] {
  if (
    value !== "pending" &&
    value !== "executing" &&
    value !== "completed"
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return value;
}

function assertCommonRecord(
  value:
    Record<string, unknown>,
  kind:
    BusinessDeletionControlStoreRecord["kind"],
): void {
  if (
    value.schemaVersion !==
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION ||
    value.keyVersion !==
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION ||
    value.kind !== kind
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  canonicalString(
    value.pk,
  );

  canonicalString(
    value.sk,
  );
}

function exactOperationKey(
  operationId:
    string,
): BusinessDeletionControlKey {
  return businessDeletionControlOperationKey(
    operationId,
  );
}

function exactIdempotencyKey(
  digest:
    string,
): BusinessDeletionControlKey {
  return businessDeletionControlIdempotencyKey(
    digest,
  );
}

function exactProgressKey(
  operationId:
    string,
  stepIndex:
    number,
): BusinessDeletionControlKey {
  return businessDeletionControlProgressKey(
    operationId,
    stepIndex,
  );
}

function exactEvidenceKey(
  operationId:
    string,
): BusinessDeletionControlKey {
  return businessDeletionControlEvidenceKey(
    operationId,
  );
}

function assertKey(
  value:
    Record<string, unknown>,
  expected:
    BusinessDeletionControlKey,
): void {
  if (
    value.pk !== expected.pk ||
    value.sk !== expected.sk
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }
}

function operationPk(
  operationId:
    string,
): string {
  return `${OPERATION_PK_PREFIX}${canonicalOperationId(
    operationId,
  )}`;
}

function holdSortKey(
  version:
    number,
): string {
  return `HOLD#${String(
    canonicalPositiveInteger(
      version,
    ),
  ).padStart(10, "0")}`;
}

function retirementKey(
  operationId:
    string,
): BusinessDeletionControlKey {
  return Object.freeze({
    pk:
      operationPk(
        operationId,
      ),
    sk:
      RETIREMENT_SORT_KEY,
  });
}

function validateOperation(
  input:
    unknown,
): BusinessDeletionControlOperationRoot {
  const value =
    objectRecord(
      input,
    );

  assertExactKeys(
    value,
    [
      "pk",
      "sk",
      "schemaVersion",
      "keyVersion",
      "kind",
      "operationId",
      "manifestIntegrityDigest",
      "policyVersion",
      "topologyVersion",
      "expectedComponentCount",
      "state",
      "stateVersion",
      "legalHoldStatus",
      "legalHoldVersion",
      "completedComponentCount",
      "createdAt",
      "updatedAt",
    ],
    [
      "terminalAt",
      "retireAfter",
    ],
  );

  assertCommonRecord(
    value,
    "operation-root",
  );

  const operationId =
    canonicalOperationId(
      value.operationId,
    );

  assertKey(
    value,
    exactOperationKey(
      operationId,
    ),
  );

  canonicalDigest(
    value.manifestIntegrityDigest,
  );

  canonicalPositiveInteger(
    value.policyVersion,
  );

  canonicalPositiveInteger(
    value.topologyVersion,
  );

  canonicalPositiveInteger(
    value.expectedComponentCount,
  );

  canonicalControlState(
    value.state,
  );

  canonicalPositiveInteger(
    value.stateVersion,
  );

  if (
    value.legalHoldStatus !== "inactive" &&
    value.legalHoldStatus !== "active"
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  canonicalPositiveInteger(
    value.legalHoldVersion,
  );

  canonicalNonNegativeInteger(
    value.completedComponentCount,
  );

  canonicalTimestamp(
    value.createdAt,
  );

  const createdAt =
    canonicalTimestamp(
      value.createdAt,
    );

  const updatedAt =
    canonicalTimestamp(
      value.updatedAt,
    );

  if (
    Date.parse(
      updatedAt,
    ) <
    Date.parse(
      createdAt,
    ) ||
    canonicalNonNegativeInteger(
      value.completedComponentCount,
    ) >
      canonicalPositiveInteger(
        value.expectedComponentCount,
      )
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  const hasTerminal =
    "terminalAt" in value;

  const hasRetireAfter =
    "retireAfter" in value;

  if (
    hasTerminal !==
    hasRetireAfter
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  if (
    hasTerminal &&
    hasRetireAfter
  ) {
    const terminalAt =
      canonicalTimestamp(
        value.terminalAt,
      );

    const retireAfter =
      canonicalTimestamp(
        value.retireAfter,
      );

    const expectedRetireAfter =
      new Date(
        Date.parse(
          terminalAt,
        ) +
          BUSINESS_DELETION_CONTROL_STORE_RETENTION_DAYS *
            24 *
            60 *
            60 *
            1000,
      ).toISOString();

    if (
      retireAfter !==
      expectedRetireAfter
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }
  }

  return Object.freeze(
    value as
      unknown as
      BusinessDeletionControlOperationRoot,
  );
}

function validateIdempotencyClaim(
  input:
    unknown,
): BusinessDeletionControlIdempotencyClaim {
  const value =
    objectRecord(
      input,
    );

  assertExactKeys(
    value,
    [
      "pk",
      "sk",
      "schemaVersion",
      "keyVersion",
      "kind",
      "pseudonymousRequestDigest",
      "operationId",
      "manifestIntegrityDigest",
      "stateVersion",
      "createdAt",
    ],
    [
      "terminalAt",
      "expireAfter",
      "ttlEpochSeconds",
      "ttlPurpose",
    ],
  );

  assertCommonRecord(
    value,
    "idempotency-claim",
  );

  const digest =
    canonicalDigest(
      value.pseudonymousRequestDigest,
    );

  assertKey(
    value,
    exactIdempotencyKey(
      digest,
    ),
  );

  canonicalOperationId(
    value.operationId,
  );

  canonicalDigest(
    value.manifestIntegrityDigest,
  );

  canonicalPositiveInteger(
    value.stateVersion,
  );

  canonicalTimestamp(
    value.createdAt,
  );

  const retirementFields =
    [
      "terminalAt",
      "expireAfter",
      "ttlEpochSeconds",
      "ttlPurpose",
    ];

  const retirementFieldCount =
    retirementFields.filter(
      (key) =>
        key in value,
    ).length;

  if (
    retirementFieldCount !== 0 &&
    retirementFieldCount !==
      retirementFields.length
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  if (
    retirementFieldCount ===
    retirementFields.length
  ) {
    const terminalAt =
      canonicalTimestamp(
        value.terminalAt,
      );

    const expireAfter =
      canonicalTimestamp(
        value.expireAfter,
      );

    const ttl =
      canonicalPositiveInteger(
        value.ttlEpochSeconds,
      );

    const expectedExpireAfter =
      new Date(
        Date.parse(
          terminalAt,
        ) +
          BUSINESS_DELETION_CONTROL_STORE_RETENTION_DAYS *
            24 *
            60 *
            60 *
            1000,
      ).toISOString();

    if (
      expireAfter !==
        expectedExpireAfter ||
      ttl !==
        Math.floor(
          Date.parse(
            expireAfter,
          ) /
            1000,
        ) ||
      value.ttlPurpose !==
        "cleanup-only-not-deletion-proof"
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }
  }

  return Object.freeze(
    value as
      unknown as
      BusinessDeletionControlIdempotencyClaim,
  );
}

function validateLegalHoldRecord(
  input:
    unknown,
): BusinessDeletionControlLegalHoldRecord {
  const value =
    objectRecord(
      input,
    );

  assertExactKeys(
    value,
    [
      "pk",
      "sk",
      "schemaVersion",
      "keyVersion",
      "kind",
      "operationId",
      "status",
      "authority",
      "version",
      "observedAt",
      "evidenceReferenceHash",
    ],
  );

  assertCommonRecord(
    value,
    "legal-hold-snapshot",
  );

  const operationId =
    canonicalOperationId(
      value.operationId,
    );

  const version =
    canonicalPositiveInteger(
      value.version,
    );

  assertKey(
    value,
    Object.freeze({
      pk:
        operationPk(
          operationId,
        ),
      sk:
        holdSortKey(
          version,
        ),
    }),
  );

  if (
    value.status !== "inactive" &&
    value.status !== "active"
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  if (
    value.authority !==
    "compliance-control"
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  canonicalTimestamp(
    value.observedAt,
  );

  canonicalDigest(
    value.evidenceReferenceHash,
  );

  return Object.freeze(
    value as
      unknown as
      BusinessDeletionControlLegalHoldRecord,
  );
}

function validateLease(
  input:
    unknown,
): NonNullable<
  BusinessDeletionControlProgressRecord["lease"]
> {
  const value =
    objectRecord(
      input,
    );

  assertExactKeys(
    value,
    [
      "tokenDigest",
      "version",
      "acquiredAt",
      "expiresAt",
    ],
  );

  canonicalDigest(
    value.tokenDigest,
  );

  canonicalPositiveInteger(
    value.version,
  );

  canonicalTimestamp(
    value.acquiredAt,
  );

  canonicalTimestamp(
    value.expiresAt,
  );

  return Object.freeze(
    value as
      unknown as
      NonNullable<
        BusinessDeletionControlProgressRecord["lease"]
      >,
  );
}

function validateProgress(
  input:
    unknown,
): BusinessDeletionControlProgressRecord {
  const value =
    objectRecord(
      input,
    );

  assertExactKeys(
    value,
    [
      "pk",
      "sk",
      "schemaVersion",
      "keyVersion",
      "kind",
      "operationId",
      "manifestIntegrityDigest",
      "stepIndex",
      "componentRangeDigest",
      "expectedComponentCount",
      "completedComponentCount",
      "state",
      "stateVersion",
      "attemptCount",
      "leaseVersion",
      "createdAt",
      "updatedAt",
    ],
    [
      "lease",
      "completedAt",
    ],
  );

  assertCommonRecord(
    value,
    "progress",
  );

  const operationId =
    canonicalOperationId(
      value.operationId,
    );

  const stepIndex =
    canonicalPositiveInteger(
      value.stepIndex,
    );

  assertKey(
    value,
    exactProgressKey(
      operationId,
      stepIndex,
    ),
  );

  canonicalDigest(
    value.manifestIntegrityDigest,
  );

  canonicalDigest(
    value.componentRangeDigest,
  );

  canonicalPositiveInteger(
    value.expectedComponentCount,
  );

  canonicalNonNegativeInteger(
    value.completedComponentCount,
  );

  canonicalProgressState(
    value.state,
  );

  canonicalPositiveInteger(
    value.stateVersion,
  );

  canonicalNonNegativeInteger(
    value.attemptCount,
  );

  canonicalNonNegativeInteger(
    value.leaseVersion,
  );

  canonicalTimestamp(
    value.createdAt,
  );

  canonicalTimestamp(
    value.updatedAt,
  );

  if ("lease" in value) {
    const lease =
      validateLease(
        value.lease,
      );

    if (
      lease.version !==
        value.leaseVersion ||
      Date.parse(
        lease.expiresAt,
      ) <=
        Date.parse(
          lease.acquiredAt,
        )
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }
  }

  const hasCompletedAt =
    "completedAt" in value;

  if (hasCompletedAt) {
    canonicalTimestamp(
      value.completedAt,
    );
  }

  if (
    canonicalNonNegativeInteger(
      value.completedComponentCount,
    ) >
      canonicalPositiveInteger(
        value.expectedComponentCount,
      ) ||
    (value.state ===
      "completed") !==
      hasCompletedAt ||
    (
      value.state ===
        "completed" &&
      "lease" in value
    )
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return Object.freeze(
    value as
      unknown as
      BusinessDeletionControlProgressRecord,
  );
}

function validateTerminalEvidence(
  input:
    unknown,
): BusinessDeletionControlTerminalEvidenceRecord {
  const value =
    objectRecord(
      input,
    );

  assertExactKeys(
    value,
    [
      "pk",
      "sk",
      "schemaVersion",
      "keyVersion",
      "kind",
      "operationId",
      "policyVersion",
      "topologyVersion",
      "manifestIntegrityDigest",
      "expectedComponentCount",
      "deletedComponentCount",
      "completedAt",
      "outcome",
      "backupDisclosureVersion",
      "backupDisclosure",
      "retentionMode",
    ],
  );

  assertCommonRecord(
    value,
    "terminal-evidence",
  );

  const operationId =
    canonicalOperationId(
      value.operationId,
    );

  assertKey(
    value,
    exactEvidenceKey(
      operationId,
    ),
  );

  canonicalPositiveInteger(
    value.policyVersion,
  );

  canonicalPositiveInteger(
    value.topologyVersion,
  );

  canonicalDigest(
    value.manifestIntegrityDigest,
  );

  canonicalPositiveInteger(
    value.expectedComponentCount,
  );

  const expectedComponentCount =
    canonicalPositiveInteger(
      value.expectedComponentCount,
    );

  const deletedComponentCount =
    canonicalPositiveInteger(
      value.deletedComponentCount,
    );

  if (
    deletedComponentCount !==
    expectedComponentCount
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  canonicalTimestamp(
    value.completedAt,
  );

  if (
    value.outcome !==
      "active-store-components-deleted" ||
    value.backupDisclosureVersion !== 1 ||
    value.backupDisclosure !==
      "active-store-only-pitr-backups-and-exports-may-retain-until-expiry" ||
    value.retentionMode !==
      "audit-policy-retained"
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return Object.freeze(
    value as
      unknown as
      BusinessDeletionControlTerminalEvidenceRecord,
  );
}

function validateRetirementMarker(
  input:
    unknown,
): BusinessDeletionControlRetirementMarker {
  const value =
    objectRecord(
      input,
    );

  assertExactKeys(
    value,
    [
      "pk",
      "sk",
      "schemaVersion",
      "keyVersion",
      "kind",
      "operationId",
      "terminalAt",
      "retireAfter",
      "ttlEpochSeconds",
      "scope",
      "ttlPurpose",
    ],
  );

  assertCommonRecord(
    value,
    "retirement-marker",
  );

  const operationId =
    canonicalOperationId(
      value.operationId,
    );

  assertKey(
    value,
    retirementKey(
      operationId,
    ),
  );

  canonicalTimestamp(
    value.terminalAt,
  );

  canonicalTimestamp(
    value.retireAfter,
  );

  const ttl =
    canonicalPositiveInteger(
      value.ttlEpochSeconds,
    );

  if (
    ttl !==
      Math.floor(
        Date.parse(
          canonicalTimestamp(
            value.retireAfter,
          ),
        ) /
          1000,
      )
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  if (
    value.scope !==
      "transient-control-records-only" ||
    value.ttlPurpose !==
      "cleanup-only-not-deletion-proof"
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return Object.freeze(
    value as
      unknown as
      BusinessDeletionControlRetirementMarker,
  );
}

function validateRecord(
  input:
    unknown,
): BusinessDeletionControlStoreRecord {
  const value =
    objectRecord(
      input,
    );

  if (
    typeof value.kind !==
    "string" ||
    !(
      BUSINESS_DELETION_CONTROL_RECORD_KINDS as
        readonly string[]
    ).includes(
      value.kind,
    )
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  switch (value.kind) {
    case "operation-root":
      return validateOperation(
        value,
      );
    case "idempotency-claim":
      return validateIdempotencyClaim(
        value,
      );
    case "legal-hold-snapshot":
      return validateLegalHoldRecord(
        value,
      );
    case "progress":
      return validateProgress(
        value,
      );
    case "terminal-evidence":
      return validateTerminalEvidence(
        value,
      );
    case "retirement-marker":
      return validateRetirementMarker(
        value,
      );
  }

  throw new BusinessDeletionControlPersistenceDataIntegrityError();
}

function recordJson(
  record:
    BusinessDeletionControlStoreRecord,
): string {
  const validated =
    validateRecord(
      record,
    );

  const serialized =
    JSON.stringify(
      validated,
    );

  if (
    new TextEncoder()
      .encode(
        serialized,
      )
      .byteLength >
    BUSINESS_DELETION_CONTROL_PERSISTENCE_MAX_RECORD_JSON_BYTES
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return serialized;
}

function stringValue(
  value:
    string,
): AttributeValue {
  return {
    S: value,
  };
}

function numberValue(
  value:
    number,
): AttributeValue {
  return {
    N:
      String(
        value,
      ),
  };
}

function itemString(
  item:
    Item,
  name:
    string,
): string | undefined {
  const value =
    item[name];

  if (
    !value ||
    !("S" in value)
  ) {
    return undefined;
  }

  return value.S;
}

function itemNumber(
  item:
    Item,
  name:
    string,
): number | undefined {
  const value =
    item[name];

  if (
    !value ||
    !("N" in value) ||
    typeof value.N !== "string"
  ) {
    return undefined;
  }

  const parsed =
    Number(
      value.N,
    );

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function assertItemMatchesRecord(
  item:
    Item,
  record:
    BusinessDeletionControlStoreRecord,
): void {
  if (
    itemString(
      item,
      "pk",
    ) !== record.pk ||
    itemString(
      item,
      "sk",
    ) !== record.sk ||
    itemString(
      item,
      "kind",
    ) !== record.kind ||
    itemNumber(
      item,
      "schemaVersion",
    ) !== record.schemaVersion ||
    itemNumber(
      item,
      "keyVersion",
    ) !== record.keyVersion
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  if (
    "operationId" in record &&
    itemString(
      item,
      "operationId",
    ) !== record.operationId
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  switch (record.kind) {
    case "operation-root":
      if (
        itemString(
          item,
          "state",
        ) !== record.state ||
        itemNumber(
          item,
          "stateVersion",
        ) !== record.stateVersion ||
        itemNumber(
          item,
          "legalHoldVersion",
        ) !== record.legalHoldVersion ||
        itemString(
          item,
          "manifestIntegrityDigest",
        ) !== record.manifestIntegrityDigest ||
        TTL_ATTRIBUTE in item
      ) {
        throw new BusinessDeletionControlPersistenceDataIntegrityError();
      }
      break;

    case "idempotency-claim": {
      const storedTerminal =
        itemString(
          item,
          "terminalAt",
        );

      const storedTtl =
        itemNumber(
          item,
          TTL_ATTRIBUTE,
        );

      if (
        itemNumber(
          item,
          "stateVersion",
        ) !== record.stateVersion ||
        itemString(
          item,
          "pseudonymousRequestDigest",
        ) !== record.pseudonymousRequestDigest ||
        itemString(
          item,
          "manifestIntegrityDigest",
        ) !== record.manifestIntegrityDigest ||
        storedTerminal !==
          record.terminalAt ||
        storedTtl !==
          record.ttlEpochSeconds
      ) {
        throw new BusinessDeletionControlPersistenceDataIntegrityError();
      }
      break;
    }

    case "legal-hold-snapshot":
      if (
        itemNumber(
          item,
          "version",
        ) !== record.version ||
        TTL_ATTRIBUTE in item
      ) {
        throw new BusinessDeletionControlPersistenceDataIntegrityError();
      }
      break;

    case "progress":
      if (
        itemString(
          item,
          "state",
        ) !== record.state ||
        itemNumber(
          item,
          "stateVersion",
        ) !== record.stateVersion ||
        itemNumber(
          item,
          "leaseVersion",
        ) !== record.leaseVersion ||
        itemString(
          item,
          "manifestIntegrityDigest",
        ) !== record.manifestIntegrityDigest ||
        itemString(
          item,
          "leaseTokenDigest",
        ) !== record.lease?.tokenDigest ||
        TTL_ATTRIBUTE in item
      ) {
        throw new BusinessDeletionControlPersistenceDataIntegrityError();
      }
      break;

    case "terminal-evidence":
      if (
        itemString(
          item,
          "manifestIntegrityDigest",
        ) !== record.manifestIntegrityDigest ||
        TTL_ATTRIBUTE in item
      ) {
        throw new BusinessDeletionControlPersistenceDataIntegrityError();
      }
      break;

    case "retirement-marker":
      if (
        itemNumber(
          item,
          TTL_ATTRIBUTE,
        ) !== record.ttlEpochSeconds
      ) {
        throw new BusinessDeletionControlPersistenceDataIntegrityError();
      }
      break;
  }
}

function keyItem(
  key:
    BusinessDeletionControlKey,
): Item {
  return {
    pk:
      stringValue(
        key.pk,
      ),
    sk:
      stringValue(
        key.sk,
      ),
  };
}

function baseItem(
  record:
    BusinessDeletionControlStoreRecord,
): Item {
  const json =
    recordJson(
      record,
    );

  const item:
    Item = {
      ...keyItem(
        record,
      ),
      kind:
        stringValue(
          record.kind,
        ),
      schemaVersion:
        numberValue(
          record.schemaVersion,
        ),
      keyVersion:
        numberValue(
          record.keyVersion,
        ),
      [RECORD_JSON_ATTRIBUTE]:
        stringValue(
          json,
        ),
    };

  if (
    "operationId" in record
  ) {
    item.operationId =
      stringValue(
        record.operationId,
      );
  }

  return item;
}

function persistedItem(
  record:
    BusinessDeletionControlStoreRecord,
): Item {
  const item =
    baseItem(
      record,
    );

  switch (record.kind) {
    case "operation-root":
      item.state =
        stringValue(
          record.state,
        );
      item.stateVersion =
        numberValue(
          record.stateVersion,
        );
      item.legalHoldVersion =
        numberValue(
          record.legalHoldVersion,
        );
      item.manifestIntegrityDigest =
        stringValue(
          record.manifestIntegrityDigest,
        );
      break;

    case "idempotency-claim":
      item.stateVersion =
        numberValue(
          record.stateVersion,
        );
      item.pseudonymousRequestDigest =
        stringValue(
          record.pseudonymousRequestDigest,
        );
      item.manifestIntegrityDigest =
        stringValue(
          record.manifestIntegrityDigest,
        );

      if (record.terminalAt) {
        item.terminalAt =
          stringValue(
            record.terminalAt,
          );
      }

      if (
        record.ttlEpochSeconds !==
        undefined
      ) {
        item[TTL_ATTRIBUTE] =
          numberValue(
            record.ttlEpochSeconds,
          );
      }
      break;

    case "legal-hold-snapshot":
      item.version =
        numberValue(
          record.version,
        );
      break;

    case "progress":
      item.state =
        stringValue(
          record.state,
        );
      item.stateVersion =
        numberValue(
          record.stateVersion,
        );
      item.leaseVersion =
        numberValue(
          record.leaseVersion,
        );
      item.manifestIntegrityDigest =
        stringValue(
          record.manifestIntegrityDigest,
        );

      if (record.lease) {
        item.leaseTokenDigest =
          stringValue(
            record.lease.tokenDigest,
          );
      }
      break;

    case "terminal-evidence":
      item.manifestIntegrityDigest =
        stringValue(
          record.manifestIntegrityDigest,
        );
      break;

    case "retirement-marker":
      item[TTL_ATTRIBUTE] =
        numberValue(
          record.ttlEpochSeconds,
        );
      break;
  }

  return item;
}

function readRecordJson(
  item:
    Item,
): BusinessDeletionControlStoreRecord {
  const raw =
    item[RECORD_JSON_ATTRIBUTE];

  if (
    !raw ||
    !("S" in raw) ||
    typeof raw.S !== "string"
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        raw.S,
      );
  }
  catch {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  const record =
    validateRecord(
      parsed,
    );

  assertItemMatchesRecord(
    item,
    record,
  );

  return record;
}

function errorName(
  error:
    unknown,
): string | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("name" in error)
  ) {
    return undefined;
  }

  const name =
    (
      error as
        {
          readonly name?:
            unknown;
        }
    ).name;

  return typeof name === "string"
    ? name
    : undefined;
}

function transactionConditionalConflict(
  error:
    unknown,
): boolean {
  if (
    errorName(error) ===
    "ConditionalCheckFailedException"
  ) {
    return true;
  }

  if (
    errorName(error) !==
      "TransactionCanceledException" ||
    typeof error !== "object" ||
    error === null ||
    !("CancellationReasons" in error)
  ) {
    return false;
  }

  const reasons =
    (
      error as
        {
          readonly CancellationReasons?:
            unknown;
        }
    ).CancellationReasons;

  if (!Array.isArray(reasons)) {
    return false;
  }

  let sawConditional =
    false;

  for (const reason of reasons) {
    if (
      typeof reason !== "object" ||
      reason === null ||
      !("Code" in reason)
    ) {
      return false;
    }

    const code =
      (
        reason as
          {
            readonly Code?:
              unknown;
          }
      ).Code;

    if (
      code ===
      "ConditionalCheckFailed"
    ) {
      sawConditional =
        true;

      continue;
    }

    if (
      code !== "None" &&
      code !== undefined
    ) {
      return false;
    }
  }

  return sawConditional;
}

function assertDistinctKeys(
  left:
    BusinessDeletionControlKey,
  right:
    BusinessDeletionControlKey,
): void {
  if (
    left.pk === right.pk &&
    left.sk === right.sk
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }
}

function assertOperationMutation(
  guard:
    BusinessDeletionControlOperationMutationGuard,
  next:
    BusinessDeletionControlOperationRoot,
): void {
  const validated =
    validateOperation(
      next,
    );

  if (
    guard.operationId !==
      validated.operationId ||
    validated.stateVersion !==
      guard.expectedStateVersion + 1 ||
    validated.legalHoldVersion <
      guard.expectedLegalHoldVersion
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  canonicalControlState(
    guard.expectedState,
  );

  canonicalPositiveInteger(
    guard.expectedStateVersion,
  );

  canonicalPositiveInteger(
    guard.expectedLegalHoldVersion,
  );
}

function assertProgressMutation(
  guard:
    BusinessDeletionControlProgressMutationGuard,
  next:
    BusinessDeletionControlProgressRecord,
): void {
  const validated =
    validateProgress(
      next,
    );

  if (
    guard.operationId !==
      validated.operationId ||
    guard.stepIndex !==
      validated.stepIndex ||
    validated.stateVersion !==
      guard.expectedStateVersion + 1 ||
    validated.leaseVersion <
      guard.expectedLeaseVersion
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  canonicalProgressState(
    guard.expectedState,
  );

  canonicalPositiveInteger(
    guard.expectedStateVersion,
  );

  canonicalNonNegativeInteger(
    guard.expectedLeaseVersion,
  );

  if (
    guard.expectedLeaseTokenDigest !==
    undefined
  ) {
    canonicalDigest(
      guard.expectedLeaseTokenDigest,
    );
  }
}

function assertIdempotencyRetirement(
  current:
    BusinessDeletionControlIdempotencyClaim,
  next:
    BusinessDeletionControlIdempotencyClaim,
): "noop" | "update" {
  const validatedCurrent =
    validateIdempotencyClaim(
      current,
    );

  const validatedNext =
    validateIdempotencyClaim(
      next,
    );

  if (
    validatedCurrent.pk !==
      validatedNext.pk ||
    validatedCurrent.sk !==
      validatedNext.sk ||
    validatedCurrent.pseudonymousRequestDigest !==
      validatedNext.pseudonymousRequestDigest ||
    validatedCurrent.operationId !==
      validatedNext.operationId ||
    validatedCurrent.manifestIntegrityDigest !==
      validatedNext.manifestIntegrityDigest
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  if (
    validatedCurrent.stateVersion ===
      validatedNext.stateVersion &&
    validatedCurrent.terminalAt ===
      validatedNext.terminalAt &&
    validatedCurrent.ttlEpochSeconds ===
      validatedNext.ttlEpochSeconds
  ) {
    return "noop";
  }

  if (
    validatedCurrent.terminalAt !==
      undefined ||
    validatedNext.terminalAt ===
      undefined ||
    validatedNext.ttlEpochSeconds ===
      undefined ||
    validatedNext.stateVersion !==
      validatedCurrent.stateVersion + 1
  ) {
    throw new BusinessDeletionControlPersistenceDataIntegrityError();
  }

  return "update";
}

const CREATE_ONLY_NAMES =
  Object.freeze({
    "#pk":
      "pk",
    "#sk":
      "sk",
  });

const CREATE_ONLY_CONDITION =
  "attribute_not_exists(#pk) AND attribute_not_exists(#sk)";

export class BusinessDeletionControlPersistence {
  constructor(
    private readonly config:
      BusinessDeletionControlPersistenceConfig,
    private readonly client =
      new DynamoDBClient({
        region:
          config.region,
      }),
  ) {
    if (
      !AWS_REGION_PATTERN.test(
        config.region,
      ) ||
      config.tableName.trim() !==
        config.tableName ||
      !TABLE_NAME_PATTERN.test(
        config.tableName,
      )
    ) {
      throw new Error(
        "Deletion control persistence configuration is invalid.",
      );
    }
  }

  private async sendRead(
    command:
      GetItemCommand,
  ): Promise<
    GetItemCommandOutput
  > {
    try {
      return await this.client.send(
        command,
      );
    }
    catch {
      throw new BusinessDeletionControlPersistenceUnavailableError();
    }
  }

  private async sendConditionalWrite(
    command:
      | PutItemCommand
      | UpdateItemCommand
      | TransactWriteItemsCommand,
  ): Promise<void> {
    try {
      if (
        command instanceof
        PutItemCommand
      ) {
        await this.client.send(
          command,
        );
        return;
      }

      if (
        command instanceof
        UpdateItemCommand
      ) {
        await this.client.send(
          command,
        );
        return;
      }

      await this.client.send(
        command,
      );
    }
    catch (error) {
      if (
        transactionConditionalConflict(
          error,
        )
      ) {
        throw new BusinessDeletionControlPersistenceConflictError();
      }

      throw new BusinessDeletionControlPersistenceUnavailableError();
    }
  }

  private async getByKey(
    key:
      BusinessDeletionControlKey,
  ): Promise<
    BusinessDeletionControlStoreRecord |
    null
  > {
    const response =
      await this.sendRead(
        new GetItemCommand({
          TableName:
            this.config.tableName,
          Key:
            keyItem(
              key,
            ),
          ConsistentRead:
            true,
        }),
      );

    if (!response.Item) {
      return null;
    }

    const record =
      readRecordJson(
        response.Item,
      );

    if (
      record.pk !== key.pk ||
      record.sk !== key.sk
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }

    return record;
  }

  async getOperation(
    operationId:
      string,
  ): Promise<
    BusinessDeletionControlOperationRoot |
    null
  > {
    const key =
      exactOperationKey(
        canonicalOperationId(
          operationId,
        ),
      );

    const record =
      await this.getByKey(
        key,
      );

    if (!record) {
      return null;
    }

    if (
      record.kind !==
      "operation-root"
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }

    return record;
  }

  async getIdempotencyClaim(
    pseudonymousRequestDigest:
      string,
  ): Promise<
    BusinessDeletionControlIdempotencyClaim |
    null
  > {
    const key =
      exactIdempotencyKey(
        canonicalDigest(
          pseudonymousRequestDigest,
        ),
      );

    const record =
      await this.getByKey(
        key,
      );

    if (!record) {
      return null;
    }

    if (
      record.kind !==
      "idempotency-claim"
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }

    return record;
  }

  async getProgress(
    operationId:
      string,
    stepIndex:
      number,
  ): Promise<
    BusinessDeletionControlProgressRecord |
    null
  > {
    const key =
      exactProgressKey(
        canonicalOperationId(
          operationId,
        ),
        canonicalPositiveInteger(
          stepIndex,
        ),
      );

    const record =
      await this.getByKey(
        key,
      );

    if (!record) {
      return null;
    }

    if (
      record.kind !==
      "progress"
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }

    return record;
  }

  async createOperationAndClaim(
    operation:
      BusinessDeletionControlOperationRoot,
    claim:
      BusinessDeletionControlIdempotencyClaim,
  ): Promise<void> {
    const validatedOperation =
      validateOperation(
        operation,
      );

    const validatedClaim =
      validateIdempotencyClaim(
        claim,
      );

    if (
      validatedOperation.operationId !==
        validatedClaim.operationId ||
      validatedOperation.manifestIntegrityDigest !==
        validatedClaim.manifestIntegrityDigest
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }

    assertDistinctKeys(
      validatedOperation,
      validatedClaim,
    );

    await this.sendConditionalWrite(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Put: {
              TableName:
                this.config.tableName,
              Item:
                persistedItem(
                  validatedOperation,
                ),
              ConditionExpression:
                CREATE_ONLY_CONDITION,
              ExpressionAttributeNames:
                CREATE_ONLY_NAMES,
            },
          },
          {
            Put: {
              TableName:
                this.config.tableName,
              Item:
                persistedItem(
                  validatedClaim,
                ),
              ConditionExpression:
                CREATE_ONLY_CONDITION,
              ExpressionAttributeNames:
                CREATE_ONLY_NAMES,
            },
          },
        ],
      }),
    );
  }

  async putLegalHoldSnapshot(
    record:
      BusinessDeletionControlLegalHoldRecord,
  ): Promise<void> {
    await this.putCreateOnly(
      validateLegalHoldRecord(
        record,
      ),
    );
  }

  async putProgress(
    record:
      BusinessDeletionControlProgressRecord,
  ): Promise<void> {
    await this.putCreateOnly(
      validateProgress(
        record,
      ),
    );
  }

  async putTerminalEvidence(
    record:
      BusinessDeletionControlTerminalEvidenceRecord,
  ): Promise<void> {
    const validated =
      validateTerminalEvidence(
        record,
      );

    const item =
      persistedItem(
        validated,
      );

    if (TTL_ATTRIBUTE in item) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }

    await this.putCreateOnly(
      validated,
    );
  }

  async putRetirementMarker(
    record:
      BusinessDeletionControlRetirementMarker,
  ): Promise<void> {
    const validated =
      validateRetirementMarker(
        record,
      );

    const item =
      persistedItem(
        validated,
      );

    if (
      !item[TTL_ATTRIBUTE] ||
      !("N" in item[TTL_ATTRIBUTE])
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }

    await this.putCreateOnly(
      validated,
    );
  }

  private async putCreateOnly(
    record:
      BusinessDeletionControlStoreRecord,
  ): Promise<void> {
    await this.sendConditionalWrite(
      new PutItemCommand({
        TableName:
          this.config.tableName,
        Item:
          persistedItem(
            record,
          ),
        ConditionExpression:
          CREATE_ONLY_CONDITION,
        ExpressionAttributeNames:
          CREATE_ONLY_NAMES,
      }),
    );
  }

  async updateOperation(
    guard:
      BusinessDeletionControlOperationMutationGuard,
    next:
      BusinessDeletionControlOperationRoot,
  ): Promise<void> {
    assertOperationMutation(
      guard,
      next,
    );

    const validated =
      validateOperation(
        next,
      );

    await this.sendConditionalWrite(
      new UpdateItemCommand({
        TableName:
          this.config.tableName,
        Key:
          keyItem(
            exactOperationKey(
              guard.operationId,
            ),
          ),
        ConditionExpression:
          "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #state = :expectedState AND #stateVersion = :expectedStateVersion AND #legalHoldVersion = :expectedLegalHoldVersion",
        UpdateExpression:
          "SET #recordJson = :recordJson, #state = :nextState, #stateVersion = :nextStateVersion, #legalHoldVersion = :nextLegalHoldVersion",
        ExpressionAttributeNames: {
          "#pk":
            "pk",
          "#sk":
            "sk",
          "#kind":
            "kind",
          "#recordJson":
            RECORD_JSON_ATTRIBUTE,
          "#state":
            "state",
          "#stateVersion":
            "stateVersion",
          "#legalHoldVersion":
            "legalHoldVersion",
        },
        ExpressionAttributeValues: {
          ":kind":
            stringValue(
              "operation-root",
            ),
          ":expectedState":
            stringValue(
              guard.expectedState,
            ),
          ":expectedStateVersion":
            numberValue(
              guard.expectedStateVersion,
            ),
          ":expectedLegalHoldVersion":
            numberValue(
              guard.expectedLegalHoldVersion,
            ),
          ":recordJson":
            stringValue(
              recordJson(
                validated,
              ),
            ),
          ":nextState":
            stringValue(
              validated.state,
            ),
          ":nextStateVersion":
            numberValue(
              validated.stateVersion,
            ),
          ":nextLegalHoldVersion":
            numberValue(
              validated.legalHoldVersion,
            ),
        },
      }),
    );
  }

  async updateProgress(
    guard:
      BusinessDeletionControlProgressMutationGuard,
    next:
      BusinessDeletionControlProgressRecord,
  ): Promise<void> {
    assertProgressMutation(
      guard,
      next,
    );

    const validated =
      validateProgress(
        next,
      );

    const expressionAttributeNames:
      Record<string, string> = {
        "#pk":
          "pk",
        "#sk":
          "sk",
        "#kind":
          "kind",
        "#recordJson":
          RECORD_JSON_ATTRIBUTE,
        "#state":
          "state",
        "#stateVersion":
          "stateVersion",
        "#leaseVersion":
          "leaseVersion",
        "#leaseTokenDigest":
          "leaseTokenDigest",
      };

    const expressionAttributeValues:
      Record<string, AttributeValue> = {
        ":kind":
          stringValue(
            "progress",
          ),
        ":expectedState":
          stringValue(
            guard.expectedState,
          ),
        ":expectedStateVersion":
          numberValue(
            guard.expectedStateVersion,
          ),
        ":expectedLeaseVersion":
          numberValue(
            guard.expectedLeaseVersion,
          ),
        ":recordJson":
          stringValue(
            recordJson(
              validated,
            ),
          ),
        ":nextState":
          stringValue(
            validated.state,
          ),
        ":nextStateVersion":
          numberValue(
            validated.stateVersion,
          ),
        ":nextLeaseVersion":
          numberValue(
            validated.leaseVersion,
          ),
      };

    let leaseCondition:
      string;

    if (
      guard.expectedLeaseTokenDigest !==
      undefined
    ) {
      leaseCondition =
        "#leaseTokenDigest = :expectedLeaseTokenDigest";

      expressionAttributeValues[
        ":expectedLeaseTokenDigest"
      ] =
        stringValue(
          guard.expectedLeaseTokenDigest,
        );
    }
    else {
      leaseCondition =
        "attribute_not_exists(#leaseTokenDigest)";
    }

    let updateExpression =
      "SET #recordJson = :recordJson, #state = :nextState, #stateVersion = :nextStateVersion, #leaseVersion = :nextLeaseVersion";

    if (validated.lease) {
      updateExpression +=
        ", #leaseTokenDigest = :nextLeaseTokenDigest";

      expressionAttributeValues[
        ":nextLeaseTokenDigest"
      ] =
        stringValue(
          validated.lease.tokenDigest,
        );
    }
    else {
      updateExpression +=
        " REMOVE #leaseTokenDigest";
    }

    await this.sendConditionalWrite(
      new UpdateItemCommand({
        TableName:
          this.config.tableName,
        Key:
          keyItem(
            exactProgressKey(
              guard.operationId,
              guard.stepIndex,
            ),
          ),
        ConditionExpression:
          "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #state = :expectedState AND #stateVersion = :expectedStateVersion AND #leaseVersion = :expectedLeaseVersion AND " +
          leaseCondition,
        UpdateExpression:
          updateExpression,
        ExpressionAttributeNames:
          expressionAttributeNames,
        ExpressionAttributeValues:
          expressionAttributeValues,
      }),
    );
  }

  async persistIdempotencyRetirement(
    current:
      BusinessDeletionControlIdempotencyClaim,
    next:
      BusinessDeletionControlIdempotencyClaim,
  ): Promise<void> {
    const decision =
      assertIdempotencyRetirement(
        current,
        next,
      );

    if (decision === "noop") {
      return;
    }

    const validatedCurrent =
      validateIdempotencyClaim(
        current,
      );

    const validatedNext =
      validateIdempotencyClaim(
        next,
      );

    if (
      !validatedNext.terminalAt ||
      validatedNext.ttlEpochSeconds ===
        undefined
    ) {
      throw new BusinessDeletionControlPersistenceDataIntegrityError();
    }

    await this.sendConditionalWrite(
      new UpdateItemCommand({
        TableName:
          this.config.tableName,
        Key:
          keyItem(
            exactIdempotencyKey(
              validatedCurrent.pseudonymousRequestDigest,
            ),
          ),
        ConditionExpression:
          "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #stateVersion = :expectedStateVersion AND #operationId = :operationId AND #manifestIntegrityDigest = :manifestIntegrityDigest AND #pseudonymousRequestDigest = :pseudonymousRequestDigest AND attribute_not_exists(#terminalAt)",
        UpdateExpression:
          "SET #recordJson = :recordJson, #stateVersion = :nextStateVersion, #terminalAt = :terminalAt, #ttl = :ttl",
        ExpressionAttributeNames: {
          "#pk":
            "pk",
          "#sk":
            "sk",
          "#kind":
            "kind",
          "#recordJson":
            RECORD_JSON_ATTRIBUTE,
          "#stateVersion":
            "stateVersion",
          "#operationId":
            "operationId",
          "#manifestIntegrityDigest":
            "manifestIntegrityDigest",
          "#pseudonymousRequestDigest":
            "pseudonymousRequestDigest",
          "#terminalAt":
            "terminalAt",
          "#ttl":
            TTL_ATTRIBUTE,
        },
        ExpressionAttributeValues: {
          ":kind":
            stringValue(
              "idempotency-claim",
            ),
          ":expectedStateVersion":
            numberValue(
              validatedCurrent.stateVersion,
            ),
          ":operationId":
            stringValue(
              validatedCurrent.operationId,
            ),
          ":manifestIntegrityDigest":
            stringValue(
              validatedCurrent.manifestIntegrityDigest,
            ),
          ":pseudonymousRequestDigest":
            stringValue(
              validatedCurrent.pseudonymousRequestDigest,
            ),
          ":recordJson":
            stringValue(
              recordJson(
                validatedNext,
              ),
            ),
          ":nextStateVersion":
            numberValue(
              validatedNext.stateVersion,
            ),
          ":terminalAt":
            stringValue(
              validatedNext.terminalAt,
            ),
          ":ttl":
            numberValue(
              validatedNext.ttlEpochSeconds,
            ),
        },
      }),
    );
  }
}
