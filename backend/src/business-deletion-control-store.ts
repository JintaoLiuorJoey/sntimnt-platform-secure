import {
  BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION,
  BUSINESS_DELETION_CONTROL_RETENTION_DAYS,
  BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
  BUSINESS_DELETION_TOPOLOGY_VERSION,
  type BusinessDeletionCompletionEvidence,
  type BusinessDeletionLegalHoldSnapshot,
  type BusinessDeletionManifest,
} from "./business-deletion-execution.js";
import {
  BUSINESS_RETENTION_POLICY_VERSION,
} from "./business-retention-lifecycle.js";

export const BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION =
  1 as const;

export const BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION =
  1 as const;

export const BUSINESS_DELETION_CONTROL_STORE_RETENTION_DAYS =
  BUSINESS_DELETION_CONTROL_RETENTION_DAYS;

export const BUSINESS_DELETION_CONTROL_MAX_LEASE_SECONDS =
  15 * 60;

export const BUSINESS_DELETION_CONTROL_STATES =
  Object.freeze([
    "planned",
    "blocked-legal-hold",
    "ready",
    "executing",
    "partially-complete",
    "completed",
    "failed-closed",
    "retired",
  ] as const);

export type BusinessDeletionControlState =
  (typeof BUSINESS_DELETION_CONTROL_STATES)[number];

export const BUSINESS_DELETION_CONTROL_RECORD_KINDS =
  Object.freeze([
    "operation-root",
    "idempotency-claim",
    "legal-hold-snapshot",
    "progress",
    "terminal-evidence",
    "retirement-marker",
  ] as const);

export type BusinessDeletionControlRecordKind =
  (typeof BUSINESS_DELETION_CONTROL_RECORD_KINDS)[number];

export const BUSINESS_DELETION_CONTROL_TTL_BOUNDARY =
  Object.freeze({
    transientControlRecords:
      "cleanup-only-after-reviewed-retention",
    terminalEvidence:
      "audit-policy-retained",
    proofOfDeletion:
      false,
  } as const);

export const BUSINESS_DELETION_CONTROL_PRIVACY_BOUNDARY =
  Object.freeze({
    rawOwnerId:
      "prohibited",
    cognitoSubject:
      "prohibited",
    businessRecordId:
      "prohibited",
    rawBusinessLocator:
      "prohibited",
    plaintext:
      "prohibited",
    ciphertext:
      "prohibited",
    rawIdempotencyKey:
      "prohibited",
    rawErrorMessage:
      "prohibited",
    partitionStrategy:
      "random-operation-or-keyed-pseudonymous-digest",
    workerDiscovery:
      "no-scan",
  } as const);

export interface BusinessDeletionControlKey {
  readonly pk:
    string;
  readonly sk:
    string;
}

export interface BusinessDeletionControlOperationRoot
  extends BusinessDeletionControlKey {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION;
  readonly keyVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION;
  readonly kind:
    "operation-root";
  readonly operationId:
    string;
  readonly manifestIntegrityDigest:
    string;
  readonly policyVersion:
    typeof BUSINESS_RETENTION_POLICY_VERSION;
  readonly topologyVersion:
    typeof BUSINESS_DELETION_TOPOLOGY_VERSION;
  readonly expectedComponentCount:
    number;
  readonly state:
    BusinessDeletionControlState;
  readonly stateVersion:
    number;
  readonly legalHoldStatus:
    BusinessDeletionLegalHoldSnapshot["status"];
  readonly legalHoldVersion:
    number;
  readonly completedComponentCount:
    number;
  readonly createdAt:
    string;
  readonly updatedAt:
    string;
  readonly terminalAt?:
    string;
  readonly retireAfter?:
    string;
}

export interface BusinessDeletionControlIdempotencyClaim
  extends BusinessDeletionControlKey {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION;
  readonly keyVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION;
  readonly kind:
    "idempotency-claim";
  readonly pseudonymousRequestDigest:
    string;
  readonly operationId:
    string;
  readonly manifestIntegrityDigest:
    string;
  readonly stateVersion:
    number;
  readonly createdAt:
    string;
  readonly terminalAt?:
    string;
  readonly expireAfter?:
    string;
  readonly ttlEpochSeconds?:
    number;
  readonly ttlPurpose?:
    "cleanup-only-not-deletion-proof";
}

export interface BusinessDeletionControlLegalHoldRecord
  extends BusinessDeletionControlKey {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION;
  readonly keyVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION;
  readonly kind:
    "legal-hold-snapshot";
  readonly operationId:
    string;
  readonly status:
    BusinessDeletionLegalHoldSnapshot["status"];
  readonly authority:
    BusinessDeletionLegalHoldSnapshot["authority"];
  readonly version:
    number;
  readonly observedAt:
    string;
  readonly evidenceReferenceHash:
    string;
}

export type BusinessDeletionControlProgressState =
  | "pending"
  | "executing"
  | "completed";

export interface BusinessDeletionControlLease {
  readonly tokenDigest:
    string;
  readonly version:
    number;
  readonly acquiredAt:
    string;
  readonly expiresAt:
    string;
}

export interface BusinessDeletionControlProgressRecord
  extends BusinessDeletionControlKey {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION;
  readonly keyVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION;
  readonly kind:
    "progress";
  readonly operationId:
    string;
  readonly manifestIntegrityDigest:
    string;
  readonly stepIndex:
    number;
  readonly componentRangeDigest:
    string;
  readonly expectedComponentCount:
    number;
  readonly completedComponentCount:
    number;
  readonly state:
    BusinessDeletionControlProgressState;
  readonly stateVersion:
    number;
  readonly attemptCount:
    number;
  readonly leaseVersion:
    number;
  readonly lease?:
    BusinessDeletionControlLease;
  readonly createdAt:
    string;
  readonly updatedAt:
    string;
  readonly completedAt?:
    string;
}

export interface BusinessDeletionControlTerminalEvidenceRecord
  extends BusinessDeletionControlKey {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION;
  readonly keyVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION;
  readonly kind:
    "terminal-evidence";
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
  readonly retentionMode:
    "audit-policy-retained";
}

export interface BusinessDeletionControlRetirementMarker
  extends BusinessDeletionControlKey {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION;
  readonly keyVersion:
    typeof BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION;
  readonly kind:
    "retirement-marker";
  readonly operationId:
    string;
  readonly terminalAt:
    string;
  readonly retireAfter:
    string;
  readonly ttlEpochSeconds:
    number;
  readonly scope:
    "transient-control-records-only";
  readonly ttlPurpose:
    "cleanup-only-not-deletion-proof";
}

export type BusinessDeletionControlStoreRecord =
  | BusinessDeletionControlOperationRoot
  | BusinessDeletionControlIdempotencyClaim
  | BusinessDeletionControlLegalHoldRecord
  | BusinessDeletionControlProgressRecord
  | BusinessDeletionControlTerminalEvidenceRecord
  | BusinessDeletionControlRetirementMarker;

export interface BusinessDeletionControlOperationTransitionInput {
  readonly expectedStateVersion:
    number;
  readonly targetState:
    BusinessDeletionControlState;
  readonly legalHoldSnapshot:
    BusinessDeletionLegalHoldSnapshot;
  readonly completedComponentCount:
    number;
  readonly updatedAt:
    string;
}

export interface BusinessDeletionControlOperationMutationGuard {
  readonly operationId:
    string;
  readonly expectedState:
    BusinessDeletionControlState;
  readonly expectedStateVersion:
    number;
  readonly expectedLegalHoldVersion:
    number;
}

export interface BusinessDeletionControlProgressMutationGuard {
  readonly operationId:
    string;
  readonly stepIndex:
    number;
  readonly expectedState:
    BusinessDeletionControlProgressState;
  readonly expectedStateVersion:
    number;
  readonly expectedLeaseVersion:
    number;
  readonly expectedLeaseTokenDigest?:
    string;
}

export type BusinessDeletionControlIdempotencyDecision =
  | Readonly<{
      outcome:
        "create";
      claim:
        BusinessDeletionControlIdempotencyClaim;
    }>
  | Readonly<{
      outcome:
        "replay";
      claim:
        BusinessDeletionControlIdempotencyClaim;
    }>
  | Readonly<{
      outcome:
        "conflict";
    }>;

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

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

function canonicalOperationId(
  value:
    string,
): string {
  if (
    typeof value !== "string" ||
    !UUID_V4_PATTERN.test(value)
  ) {
    throw new Error(
      "Deletion control operation ID must be a lowercase UUID v4.",
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

function canonicalPositiveInteger(
  value:
    number,
  name:
    string,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `${name} must be a positive safe integer.`,
    );
  }

  return value;
}

function canonicalNonNegativeInteger(
  value:
    number,
  name:
    string,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `${name} must be a non-negative safe integer.`,
    );
  }

  return value;
}

function canonicalTimestamp(
  value:
    string,
  name:
    string,
): string {
  const parsed =
    Date.parse(value);

  if (
    typeof value !== "string" ||
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value
  ) {
    throw new Error(
      `${name} must be a canonical ISO timestamp.`,
    );
  }

  return value;
}

function addRetentionDays(
  value:
    string,
): string {
  const timestamp =
    Date.parse(
      canonicalTimestamp(
        value,
        "Deletion control terminal time",
      ),
    );

  return new Date(
    timestamp +
      BUSINESS_DELETION_CONTROL_STORE_RETENTION_DAYS *
      24 *
      60 *
      60 *
      1000,
  ).toISOString();
}

function ttlEpochSeconds(
  value:
    string,
): number {
  return Math.floor(
    Date.parse(
      canonicalTimestamp(
        value,
        "Deletion control expiration time",
      ),
    ) /
      1000,
  );
}

function operationKey(
  operationId:
    string,
): BusinessDeletionControlKey {
  const canonical =
    canonicalOperationId(
      operationId,
    );

  return Object.freeze({
    pk:
      `${OPERATION_PK_PREFIX}${canonical}`,
    sk:
      ROOT_SORT_KEY,
  });
}

function operationChildKey(
  operationId:
    string,
  sortKey:
    string,
): BusinessDeletionControlKey {
  const canonical =
    canonicalOperationId(
      operationId,
    );

  return Object.freeze({
    pk:
      `${OPERATION_PK_PREFIX}${canonical}`,
    sk:
      sortKey,
  });
}

function canonicalStepIndex(
  value:
    number,
): number {
  return canonicalPositiveInteger(
    value,
    "Deletion control step index",
  );
}

function progressSortKey(
  stepIndex:
    number,
): string {
  return `STEP#${String(
    canonicalStepIndex(
      stepIndex,
    ),
  ).padStart(6, "0")}`;
}

function legalHoldSortKey(
  version:
    number,
): string {
  return `HOLD#${String(
    canonicalPositiveInteger(
      version,
      "Legal-hold version",
    ),
  ).padStart(10, "0")}`;
}

function validateLegalHoldSnapshot(
  value:
    BusinessDeletionLegalHoldSnapshot,
): BusinessDeletionLegalHoldSnapshot {
  if (
    value.status !== "inactive" &&
    value.status !== "active"
  ) {
    throw new Error(
      "Deletion control legal-hold status is unsupported.",
    );
  }

  if (
    value.authority !==
    "compliance-control"
  ) {
    throw new Error(
      "Deletion control legal-hold authority is unsupported.",
    );
  }

  const version =
    canonicalPositiveInteger(
      value.version,
      "Legal-hold version",
    );

  return Object.freeze({
    status:
      value.status,
    authority:
      value.authority,
    version,
    observedAt:
      canonicalTimestamp(
        value.observedAt,
        "Legal-hold observation time",
      ),
    evidenceReferenceHash:
      canonicalDigest(
        value.evidenceReferenceHash,
        "Legal-hold evidence reference",
      ),
  });
}

function assertManifest(
  manifest:
    BusinessDeletionManifest,
): void {
  if (
    manifest.schemaVersion !==
      BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION ||
    manifest.policyVersion !==
      BUSINESS_RETENTION_POLICY_VERSION ||
    manifest.topologyVersion !==
      BUSINESS_DELETION_TOPOLOGY_VERSION
  ) {
    throw new Error(
      "Deletion control manifest versions are unsupported.",
    );
  }

  canonicalOperationId(
    manifest.operationId,
  );

  canonicalDigest(
    manifest.manifestIntegrityDigest,
    "Manifest integrity",
  );

  canonicalDigest(
    manifest.idempotencyKeyDigest,
    "Deletion idempotency key",
  );

  canonicalPositiveInteger(
    manifest.expectedComponentCount,
    "Expected component count",
  );

  validateLegalHoldSnapshot(
    manifest.legalHoldSnapshot,
  );
}

function frozenOperation(
  value:
    BusinessDeletionControlOperationRoot,
): BusinessDeletionControlOperationRoot {
  return Object.freeze({
    ...value,
  });
}

function allowedTransition(
  from:
    BusinessDeletionControlState,
  to:
    BusinessDeletionControlState,
): boolean {
  const allowlist =
    {
      planned: [
        "blocked-legal-hold",
        "ready",
        "failed-closed",
      ],
      "blocked-legal-hold": [
        "ready",
        "failed-closed",
      ],
      ready: [
        "blocked-legal-hold",
        "executing",
        "failed-closed",
      ],
      executing: [
        "blocked-legal-hold",
        "partially-complete",
        "completed",
        "failed-closed",
      ],
      "partially-complete": [
        "blocked-legal-hold",
        "executing",
        "completed",
        "failed-closed",
      ],
      completed: [
        "retired",
      ],
      "failed-closed": [
        "retired",
      ],
      retired: [],
    } as const satisfies
      Readonly<
        Record<
          BusinessDeletionControlState,
          readonly BusinessDeletionControlState[]
        >
      >;

  return (
    allowlist[from] as
      readonly BusinessDeletionControlState[]
  ).includes(
    to,
  );
}

function requiresInactiveLegalHold(
  state:
    BusinessDeletionControlState,
): boolean {
  return (
    state === "ready" ||
    state === "executing" ||
    state === "partially-complete" ||
    state === "completed"
  );
}

export function businessDeletionControlOperationKey(
  operationId:
    string,
): BusinessDeletionControlKey {
  return operationKey(
    operationId,
  );
}

export function businessDeletionControlIdempotencyKey(
  pseudonymousRequestDigest:
    string,
): BusinessDeletionControlKey {
  const digest =
    canonicalDigest(
      pseudonymousRequestDigest,
      "Pseudonymous deletion request",
    );

  return Object.freeze({
    pk:
      `${IDEMPOTENCY_PK_PREFIX}${digest}`,
    sk:
      IDEMPOTENCY_SORT_KEY,
  });
}

export function businessDeletionControlProgressKey(
  operationId:
    string,
  stepIndex:
    number,
): BusinessDeletionControlKey {
  return operationChildKey(
    operationId,
    progressSortKey(
      stepIndex,
    ),
  );
}

export function businessDeletionControlEvidenceKey(
  operationId:
    string,
): BusinessDeletionControlKey {
  return operationChildKey(
    operationId,
    EVIDENCE_SORT_KEY,
  );
}

export function createBusinessDeletionControlOperation(
  manifest:
    BusinessDeletionManifest,
  createdAt:
    string,
): BusinessDeletionControlOperationRoot {
  assertManifest(
    manifest,
  );

  const timestamp =
    canonicalTimestamp(
      createdAt,
      "Deletion control creation time",
    );

  if (
    Date.parse(timestamp) <
    Date.parse(manifest.createdAt)
  ) {
    throw new Error(
      "Deletion control operation cannot precede manifest creation.",
    );
  }

  const hold =
    validateLegalHoldSnapshot(
      manifest.legalHoldSnapshot,
    );

  const key =
    operationKey(
      manifest.operationId,
    );

  return frozenOperation({
    ...key,
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "operation-root",
    operationId:
      manifest.operationId,
    manifestIntegrityDigest:
      manifest.manifestIntegrityDigest,
    policyVersion:
      manifest.policyVersion,
    topologyVersion:
      manifest.topologyVersion,
    expectedComponentCount:
      manifest.expectedComponentCount,
    state:
      hold.status === "active"
        ? "blocked-legal-hold"
        : "planned",
    stateVersion:
      1,
    legalHoldStatus:
      hold.status,
    legalHoldVersion:
      hold.version,
    completedComponentCount:
      0,
    createdAt:
      timestamp,
    updatedAt:
      timestamp,
  });
}

export function createBusinessDeletionControlLegalHoldRecord(
  operation:
    BusinessDeletionControlOperationRoot,
  snapshot:
    BusinessDeletionLegalHoldSnapshot,
): BusinessDeletionControlLegalHoldRecord {
  canonicalOperationId(
    operation.operationId,
  );

  const hold =
    validateLegalHoldSnapshot(
      snapshot,
    );

  if (
    hold.version <
    operation.legalHoldVersion
  ) {
    throw new Error(
      "Deletion control legal-hold version cannot move backward.",
    );
  }

  const key =
    operationChildKey(
      operation.operationId,
      legalHoldSortKey(
        hold.version,
      ),
    );

  return Object.freeze({
    ...key,
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "legal-hold-snapshot",
    operationId:
      operation.operationId,
    status:
      hold.status,
    authority:
      hold.authority,
    version:
      hold.version,
    observedAt:
      hold.observedAt,
    evidenceReferenceHash:
      hold.evidenceReferenceHash,
  });
}

export function businessDeletionControlOperationGuard(
  operation:
    BusinessDeletionControlOperationRoot,
): BusinessDeletionControlOperationMutationGuard {
  return Object.freeze({
    operationId:
      canonicalOperationId(
        operation.operationId,
      ),
    expectedState:
      operation.state,
    expectedStateVersion:
      canonicalPositiveInteger(
        operation.stateVersion,
        "Deletion control state version",
      ),
    expectedLegalHoldVersion:
      canonicalPositiveInteger(
        operation.legalHoldVersion,
        "Legal-hold version",
      ),
  });
}

export function transitionBusinessDeletionControlOperation(
  current:
    BusinessDeletionControlOperationRoot,
  input:
    BusinessDeletionControlOperationTransitionInput,
): BusinessDeletionControlOperationRoot {
  if (
    current.state === "retired"
  ) {
    throw new Error(
      "A retired deletion control operation cannot transition.",
    );
  }

  const expectedStateVersion =
    canonicalPositiveInteger(
      input.expectedStateVersion,
      "Expected deletion control state version",
    );

  if (
    expectedStateVersion !==
    current.stateVersion
  ) {
    throw new Error(
      "Deletion control state version conflict.",
    );
  }

  if (
    !allowedTransition(
      current.state,
      input.targetState,
    )
  ) {
    throw new Error(
      "Deletion control state transition is not allowed.",
    );
  }

  const hold =
    validateLegalHoldSnapshot(
      input.legalHoldSnapshot,
    );

  if (
    hold.version <
    current.legalHoldVersion
  ) {
    throw new Error(
      "Deletion control legal-hold version cannot move backward.",
    );
  }

  if (
    requiresInactiveLegalHold(
      input.targetState,
    ) &&
    hold.status !== "inactive"
  ) {
    throw new Error(
      "Executable deletion control states require an inactive legal hold.",
    );
  }

  if (
    hold.status === "active" &&
    input.targetState !== "blocked-legal-hold" &&
    input.targetState !== "failed-closed"
  ) {
    throw new Error(
      "An active legal hold requires a blocked or failed-closed state.",
    );
  }

  const completedComponentCount =
    canonicalNonNegativeInteger(
      input.completedComponentCount,
      "Completed component count",
    );

  if (
    completedComponentCount <
    current.completedComponentCount
  ) {
    throw new Error(
      "Deletion control progress cannot decrease.",
    );
  }

  if (
    completedComponentCount >
    current.expectedComponentCount
  ) {
    throw new Error(
      "Deletion control progress exceeds the manifest component count.",
    );
  }

  if (
    input.targetState === "completed" &&
    completedComponentCount !==
      current.expectedComponentCount
  ) {
    throw new Error(
      "Deletion control completion requires every manifest component.",
    );
  }

  if (
    current.state === "completed" &&
    completedComponentCount !==
      current.expectedComponentCount
  ) {
    throw new Error(
      "Completed deletion control progress is immutable.",
    );
  }

  const timestamp =
    canonicalTimestamp(
      input.updatedAt,
      "Deletion control update time",
    );

  if (
    Date.parse(timestamp) <
    Date.parse(current.updatedAt)
  ) {
    throw new Error(
      "Deletion control time cannot move backward.",
    );
  }

  const becomesTerminal =
    input.targetState === "completed" ||
    input.targetState === "failed-closed";

  const terminalAt =
    becomesTerminal
      ? timestamp
      : current.terminalAt;

  const retireAfter =
    terminalAt
      ? addRetentionDays(
          terminalAt,
        )
      : current.retireAfter;

  if (
    input.targetState === "retired"
  ) {
    if (
      !current.terminalAt ||
      !current.retireAfter
    ) {
      throw new Error(
        "Deletion control retirement requires a terminal operation.",
      );
    }

    if (
      Date.parse(timestamp) <
      Date.parse(current.retireAfter)
    ) {
      throw new Error(
        "Deletion control operation cannot retire before its retention boundary.",
      );
    }
  }

  return frozenOperation({
    ...current,
    state:
      input.targetState,
    stateVersion:
      current.stateVersion + 1,
    legalHoldStatus:
      hold.status,
    legalHoldVersion:
      hold.version,
    completedComponentCount,
    updatedAt:
      timestamp,
    ...(terminalAt
      ? {
          terminalAt,
        }
      : {}),
    ...(retireAfter
      ? {
          retireAfter,
        }
      : {}),
  });
}

export function evaluateBusinessDeletionControlIdempotencyClaim(
  existing:
    BusinessDeletionControlIdempotencyClaim | undefined,
  manifest:
    BusinessDeletionManifest,
  pseudonymousRequestDigest:
    string,
  createdAt:
    string,
): BusinessDeletionControlIdempotencyDecision {
  assertManifest(
    manifest,
  );

  const digest =
    canonicalDigest(
      pseudonymousRequestDigest,
      "Pseudonymous deletion request",
    );

  if (
    digest ===
    manifest.idempotencyKeyDigest
  ) {
    throw new Error(
      "Pseudonymous deletion request digest must be domain-separated from the manifest idempotency digest.",
    );
  }

  const timestamp =
    canonicalTimestamp(
      createdAt,
      "Idempotency claim creation time",
    );

  if (
    Date.parse(timestamp) <
    Date.parse(manifest.createdAt)
  ) {
    throw new Error(
      "Idempotency claim cannot precede manifest creation.",
    );
  }

  const key =
    businessDeletionControlIdempotencyKey(
      digest,
    );

  const proposed:
    BusinessDeletionControlIdempotencyClaim =
    Object.freeze({
      ...key,
      schemaVersion:
        BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
      keyVersion:
        BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
      kind:
        "idempotency-claim",
      pseudonymousRequestDigest:
        digest,
      operationId:
        manifest.operationId,
      manifestIntegrityDigest:
        manifest.manifestIntegrityDigest,
      stateVersion:
        1,
      createdAt:
        timestamp,
    });

  if (!existing) {
    return Object.freeze({
      outcome:
        "create",
      claim:
        proposed,
    });
  }

  if (
    existing.pseudonymousRequestDigest ===
      digest &&
    existing.operationId ===
      manifest.operationId &&
    existing.manifestIntegrityDigest ===
      manifest.manifestIntegrityDigest
  ) {
    return Object.freeze({
      outcome:
        "replay",
      claim:
        existing,
    });
  }

  return Object.freeze({
    outcome:
      "conflict",
  });
}

export function retireBusinessDeletionControlIdempotencyClaim(
  current:
    BusinessDeletionControlIdempotencyClaim,
  terminalAt:
    string,
): BusinessDeletionControlIdempotencyClaim {
  const terminal =
    canonicalTimestamp(
      terminalAt,
      "Idempotency claim terminal time",
    );

  if (
    current.terminalAt
  ) {
    if (
      current.terminalAt === terminal
    ) {
      return current;
    }

    throw new Error(
      "Idempotency claim terminal binding is immutable.",
    );
  }

  if (
    Date.parse(terminal) <
    Date.parse(current.createdAt)
  ) {
    throw new Error(
      "Idempotency claim terminal time cannot precede creation.",
    );
  }

  const expireAfter =
    addRetentionDays(
      terminal,
    );

  return Object.freeze({
    ...current,
    stateVersion:
      current.stateVersion + 1,
    terminalAt:
      terminal,
    expireAfter,
    ttlEpochSeconds:
      ttlEpochSeconds(
        expireAfter,
      ),
    ttlPurpose:
      "cleanup-only-not-deletion-proof",
  });
}

export function createBusinessDeletionControlProgress(
  operation:
    BusinessDeletionControlOperationRoot,
  stepIndex:
    number,
  componentRangeDigest:
    string,
  expectedComponentCount:
    number,
  createdAt:
    string,
): BusinessDeletionControlProgressRecord {
  if (
    operation.state === "completed" ||
    operation.state === "failed-closed" ||
    operation.state === "retired"
  ) {
    throw new Error(
      "Terminal deletion control operations cannot create progress records.",
    );
  }

  const expected =
    canonicalPositiveInteger(
      expectedComponentCount,
      "Step component count",
    );

  if (
    expected >
    operation.expectedComponentCount
  ) {
    throw new Error(
      "Step component count exceeds the operation component count.",
    );
  }

  const timestamp =
    canonicalTimestamp(
      createdAt,
      "Deletion progress creation time",
    );

  if (
    Date.parse(timestamp) <
    Date.parse(operation.createdAt)
  ) {
    throw new Error(
      "Deletion progress cannot precede the operation.",
    );
  }

  const key =
    businessDeletionControlProgressKey(
      operation.operationId,
      stepIndex,
    );

  return Object.freeze({
    ...key,
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "progress",
    operationId:
      operation.operationId,
    manifestIntegrityDigest:
      operation.manifestIntegrityDigest,
    stepIndex:
      canonicalStepIndex(
        stepIndex,
      ),
    componentRangeDigest:
      canonicalDigest(
        componentRangeDigest,
        "Deletion component range",
      ),
    expectedComponentCount:
      expected,
    completedComponentCount:
      0,
    state:
      "pending",
    stateVersion:
      1,
    attemptCount:
      0,
    leaseVersion:
      0,
    createdAt:
      timestamp,
    updatedAt:
      timestamp,
  });
}

export function businessDeletionControlProgressGuard(
  progress:
    BusinessDeletionControlProgressRecord,
): BusinessDeletionControlProgressMutationGuard {
  return Object.freeze({
    operationId:
      canonicalOperationId(
        progress.operationId,
      ),
    stepIndex:
      canonicalStepIndex(
        progress.stepIndex,
      ),
    expectedState:
      progress.state,
    expectedStateVersion:
      canonicalPositiveInteger(
        progress.stateVersion,
        "Deletion progress state version",
      ),
    expectedLeaseVersion:
      canonicalNonNegativeInteger(
        progress.leaseVersion,
        "Deletion progress lease version",
      ),
    ...(progress.lease
      ? {
          expectedLeaseTokenDigest:
            canonicalDigest(
              progress.lease.tokenDigest,
              "Deletion lease token",
            ),
        }
      : {}),
  });
}

export function acquireBusinessDeletionControlLease(
  current:
    BusinessDeletionControlProgressRecord,
  expectedStateVersion:
    number,
  leaseTokenDigest:
    string,
  acquiredAt:
    string,
  expiresAt:
    string,
): BusinessDeletionControlProgressRecord {
  if (
    canonicalPositiveInteger(
      expectedStateVersion,
      "Expected deletion progress state version",
    ) !==
    current.stateVersion
  ) {
    throw new Error(
      "Deletion progress state version conflict.",
    );
  }

  if (
    current.state === "completed"
  ) {
    throw new Error(
      "Completed deletion progress cannot acquire a lease.",
    );
  }

  const acquired =
    canonicalTimestamp(
      acquiredAt,
      "Deletion lease acquisition time",
    );

  const expires =
    canonicalTimestamp(
      expiresAt,
      "Deletion lease expiration time",
    );

  if (
    Date.parse(acquired) <
    Date.parse(current.updatedAt)
  ) {
    throw new Error(
      "Deletion lease cannot move progress time backward.",
    );
  }

  if (
    Date.parse(expires) <=
    Date.parse(acquired)
  ) {
    throw new Error(
      "Deletion lease expiration must follow acquisition.",
    );
  }

  if (
    Date.parse(expires) -
      Date.parse(acquired) >
    BUSINESS_DELETION_CONTROL_MAX_LEASE_SECONDS *
      1000
  ) {
    throw new Error(
      "Deletion lease exceeds the supported duration.",
    );
  }

  if (
    current.lease &&
    Date.parse(current.lease.expiresAt) >
      Date.parse(acquired)
  ) {
    throw new Error(
      "An unexpired deletion lease cannot be replaced.",
    );
  }

  const tokenDigest =
    canonicalDigest(
      leaseTokenDigest,
      "Deletion lease token",
    );

  const leaseVersion =
    current.leaseVersion + 1;

  const lease =
    Object.freeze({
      tokenDigest,
      version:
        leaseVersion,
      acquiredAt:
        acquired,
      expiresAt:
        expires,
    });

  return Object.freeze({
    ...current,
    state:
      "executing",
    stateVersion:
      current.stateVersion + 1,
    attemptCount:
      current.attemptCount + 1,
    leaseVersion,
    lease,
    updatedAt:
      acquired,
  });
}

export function recordBusinessDeletionControlProgress(
  current:
    BusinessDeletionControlProgressRecord,
  expectedStateVersion:
    number,
  leaseTokenDigest:
    string,
  completedComponentCount:
    number,
  updatedAt:
    string,
): BusinessDeletionControlProgressRecord {
  if (
    canonicalPositiveInteger(
      expectedStateVersion,
      "Expected deletion progress state version",
    ) !==
    current.stateVersion
  ) {
    throw new Error(
      "Deletion progress state version conflict.",
    );
  }

  if (
    !current.lease
  ) {
    throw new Error(
      "Deletion progress requires an active lease.",
    );
  }

  const tokenDigest =
    canonicalDigest(
      leaseTokenDigest,
      "Deletion lease token",
    );

  if (
    tokenDigest !==
    current.lease.tokenDigest
  ) {
    throw new Error(
      "Deletion progress lease token conflict.",
    );
  }

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
      "Deletion progress time cannot move backward.",
    );
  }

  if (
    Date.parse(timestamp) >
    Date.parse(current.lease.expiresAt)
  ) {
    throw new Error(
      "Deletion progress lease has expired.",
    );
  }

  const completed =
    canonicalNonNegativeInteger(
      completedComponentCount,
      "Completed step component count",
    );

  if (
    completed <
    current.completedComponentCount
  ) {
    throw new Error(
      "Deletion progress cannot decrease.",
    );
  }

  if (
    completed >
    current.expectedComponentCount
  ) {
    throw new Error(
      "Deletion progress exceeds its step component count.",
    );
  }

  const isComplete =
    completed ===
    current.expectedComponentCount;

  if (isComplete) {
    const {
      lease: completedLease,
      ...withoutLease
    } = current;

    void completedLease;

    return Object.freeze({
      ...withoutLease,
      completedComponentCount:
        completed,
      state:
        "completed",
      stateVersion:
        current.stateVersion + 1,
      updatedAt:
        timestamp,
      completedAt:
        timestamp,
    });
  }

  return Object.freeze({
    ...current,
    completedComponentCount:
      completed,
    state:
      "executing",
    stateVersion:
      current.stateVersion + 1,
    updatedAt:
      timestamp,
  });
}

export function createBusinessDeletionControlTerminalEvidence(
  operation:
    BusinessDeletionControlOperationRoot,
  evidence:
    BusinessDeletionCompletionEvidence,
): BusinessDeletionControlTerminalEvidenceRecord {
  if (
    operation.state !== "completed" ||
    !operation.terminalAt
  ) {
    throw new Error(
      "Terminal deletion evidence requires a completed control operation.",
    );
  }

  if (
    evidence.schemaVersion !==
      BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION ||
    evidence.operationId !==
      operation.operationId ||
    evidence.manifestIntegrityDigest !==
      operation.manifestIntegrityDigest ||
    evidence.policyVersion !==
      operation.policyVersion ||
    evidence.topologyVersion !==
      operation.topologyVersion ||
    evidence.expectedComponentCount !==
      operation.expectedComponentCount ||
    evidence.deletedComponentCount !==
      operation.expectedComponentCount ||
    evidence.outcome !==
      "active-store-components-deleted" ||
    evidence.backupDisclosureVersion !==
      BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION ||
    evidence.backupDisclosure !==
      "active-store-only-pitr-backups-and-exports-may-retain-until-expiry"
  ) {
    throw new Error(
      "Terminal deletion evidence does not match the control operation.",
    );
  }

  const completedAt =
    canonicalTimestamp(
      evidence.completedAt,
      "Deletion completion time",
    );

  if (
    completedAt !==
    operation.terminalAt
  ) {
    throw new Error(
      "Terminal deletion evidence time does not match the control operation.",
    );
  }

  const key =
    businessDeletionControlEvidenceKey(
      operation.operationId,
    );

  return Object.freeze({
    ...key,
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "terminal-evidence",
    operationId:
      operation.operationId,
    policyVersion:
      operation.policyVersion,
    topologyVersion:
      operation.topologyVersion,
    manifestIntegrityDigest:
      operation.manifestIntegrityDigest,
    expectedComponentCount:
      operation.expectedComponentCount,
    deletedComponentCount:
      evidence.deletedComponentCount,
    completedAt,
    outcome:
      evidence.outcome,
    backupDisclosureVersion:
      evidence.backupDisclosureVersion,
    backupDisclosure:
      evidence.backupDisclosure,
    retentionMode:
      "audit-policy-retained",
  });
}

export function createBusinessDeletionControlRetirementMarker(
  operation:
    BusinessDeletionControlOperationRoot,
): BusinessDeletionControlRetirementMarker {
  if (
    operation.state !== "completed" &&
    operation.state !== "failed-closed"
  ) {
    throw new Error(
      "Deletion control retirement requires a terminal operation.",
    );
  }

  if (
    !operation.terminalAt ||
    !operation.retireAfter
  ) {
    throw new Error(
      "Deletion control terminal retention metadata is missing.",
    );
  }

  const key =
    operationChildKey(
      operation.operationId,
      RETIREMENT_SORT_KEY,
    );

  return Object.freeze({
    ...key,
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "retirement-marker",
    operationId:
      operation.operationId,
    terminalAt:
      canonicalTimestamp(
        operation.terminalAt,
        "Deletion control terminal time",
      ),
    retireAfter:
      canonicalTimestamp(
        operation.retireAfter,
        "Deletion control retirement time",
      ),
    ttlEpochSeconds:
      ttlEpochSeconds(
        operation.retireAfter,
      ),
    scope:
      "transient-control-records-only",
    ttlPurpose:
      "cleanup-only-not-deletion-proof",
  });
}
