import {
  BUSINESS_SENSITIVE_RECORD_TYPES,
  type BusinessSensitiveRecordType,
} from "./business-data-protection.js";

export const BUSINESS_RETENTION_POLICY_VERSION =
  1 as const;

export const BUSINESS_RETENTION_POLICY_BASIS =
  "provisional-us-broker-dealer-baseline-v1" as const;

export const BUSINESS_DELETION_COMPONENTS =
  Object.freeze([
    "ciphertext",
    "derived-indexes",
  ] as const);

export type BusinessDeletionComponent =
  (typeof BUSINESS_DELETION_COMPONENTS)[number];

export const BUSINESS_DELETION_AUDIT_EVENTS =
  Object.freeze([
    "business_deletion_denied",
    "business_deletion_blocked",
    "business_deletion_conflict",
    "business_deletion_eligible",
    "business_deletion_resumed",
    "business_deletion_replayed",
    "business_deletion_completed",
  ] as const);

export type BusinessDeletionAuditEvent =
  (typeof BUSINESS_DELETION_AUDIT_EVENTS)[number];

export type BusinessRetentionRecordAnchor =
  | "record-superseded"
  | "verification-recorded"
  | "banking-instrument-last-used"
  | "money-movement-settled"
  | "position-closed"
  | "trade-recorded";

export interface BusinessRetentionPolicy {
  readonly version:
    typeof BUSINESS_RETENTION_POLICY_VERSION;
  readonly basis:
    typeof BUSINESS_RETENTION_POLICY_BASIS;
  readonly recordType:
    BusinessSensitiveRecordType;
  readonly minimumRetentionYears:
    5 | 6;
  readonly recordAnchor:
    BusinessRetentionRecordAnchor;
  readonly effectiveAnchor:
    "later-of-account-closure-and-record-anchor";
  readonly authoritativeRecordTtl:
    "prohibited";
  readonly deletionMode:
    "explicit-verified-resumable";
  readonly deletionComponents:
    readonly BusinessDeletionComponent[];
  readonly completionRequiresAllComponents:
    true;
  readonly kmsKeyDeletionSubstitute:
    false;
  readonly requiresComplianceApproval:
    true;
}

function frozenPolicy(
  recordType:
    BusinessSensitiveRecordType,
  minimumRetentionYears:
    5 | 6,
  recordAnchor:
    BusinessRetentionRecordAnchor,
): BusinessRetentionPolicy {
  return Object.freeze({
    version:
      BUSINESS_RETENTION_POLICY_VERSION,
    basis:
      BUSINESS_RETENTION_POLICY_BASIS,
    recordType,
    minimumRetentionYears,
    recordAnchor,
    effectiveAnchor:
      "later-of-account-closure-and-record-anchor",
    authoritativeRecordTtl:
      "prohibited",
    deletionMode:
      "explicit-verified-resumable",
    deletionComponents:
      BUSINESS_DELETION_COMPONENTS,
    completionRequiresAllComponents:
      true,
    kmsKeyDeletionSubstitute:
      false,
    requiresComplianceApproval:
      true,
  });
}

const retentionPolicyByRecordType =
  Object.freeze({
    "investor-profile":
      frozenPolicy(
        "investor-profile",
        6,
        "record-superseded",
      ),
    "identity-verification":
      frozenPolicy(
        "identity-verification",
        5,
        "verification-recorded",
      ),
    "banking-instrument":
      frozenPolicy(
        "banking-instrument",
        6,
        "banking-instrument-last-used",
      ),
    "money-movement":
      frozenPolicy(
        "money-movement",
        6,
        "money-movement-settled",
      ),
    "portfolio-position":
      frozenPolicy(
        "portfolio-position",
        6,
        "position-closed",
      ),
    "trade-record":
      frozenPolicy(
        "trade-record",
        6,
        "trade-recorded",
      ),
  } satisfies Record<
    BusinessSensitiveRecordType,
    BusinessRetentionPolicy
  >);

export function businessRetentionPolicy(
  recordType:
    BusinessSensitiveRecordType,
): BusinessRetentionPolicy {
  if (
    !BUSINESS_SENSITIVE_RECORD_TYPES.includes(
      recordType,
    )
  ) {
    throw new Error(
      "Business sensitive record type is unsupported.",
    );
  }

  return retentionPolicyByRecordType[
    recordType
  ];
}

export const BUSINESS_TTL_BOUNDARY =
  Object.freeze({
    authoritativeSensitiveRecords:
      "prohibited",
    transientWorkflowMarkers:
      "permitted-only-after-explicit-policy-review",
    exactDeletionGuarantee:
      false,
  } as const);

export const BUSINESS_KMS_DELETION_BOUNDARY =
  Object.freeze({
    keyDisablementDeletesRecords:
      false,
    keyDeletionDeletesRecords:
      false,
    perRecordDeletionStillRequired:
      true,
  } as const);

export type BusinessAccountLifecycle =
  | Readonly<{
      status:
        "open";
    }>
  | Readonly<{
      status:
        "closure-requested";
      requestedAt:
        string;
    }>
  | Readonly<{
      status:
        "closed";
      requestedAt:
        string;
      closedAt:
        string;
    }>;

export type BusinessLegalHoldAuthority =
  | "legal"
  | "compliance"
  | "regulator";

export type BusinessLegalHold =
  | Readonly<{
      status:
        "none";
    }>
  | Readonly<{
      status:
        "active";
      authority:
        BusinessLegalHoldAuthority;
      startedAt:
        string;
      evidenceReferenceHash:
        string;
    }>
  | Readonly<{
      status:
        "released";
      authority:
        BusinessLegalHoldAuthority;
      startedAt:
        string;
      evidenceReferenceHash:
        string;
      releasedAt:
        string;
      releaseEvidenceReferenceHash:
        string;
    }>;

export type BusinessRetentionPolicyApproval =
  | Readonly<{
      status:
        "pending";
    }>
  | Readonly<{
      status:
        "approved";
      version:
        typeof BUSINESS_RETENTION_POLICY_VERSION;
      approvedAt:
        string;
      evidenceReferenceHash:
        string;
    }>;

export interface BusinessDeletionRequest {
  readonly idempotencyKey:
    string;
  readonly requestedAt:
    string;
}

export interface BusinessDeletionProgress {
  readonly idempotencyKey:
    string;
  readonly state:
    | "in-progress"
    | "completed";
  readonly deletedComponents:
    readonly BusinessDeletionComponent[];
  readonly updatedAt:
    string;
  readonly completedAt?:
    string;
}

export interface BusinessDeletionDecisionInput {
  readonly authorizedOwnerPartitionKey:
    string;
  readonly targetOwnerPartitionKey:
    string;
  readonly recordType:
    BusinessSensitiveRecordType;
  readonly recordRetentionAnchorAt:
    string;
  readonly account:
    BusinessAccountLifecycle;
  readonly legalHold:
    BusinessLegalHold;
  readonly policyApproval:
    BusinessRetentionPolicyApproval;
  readonly request:
    BusinessDeletionRequest;
  readonly existingProgress?:
    BusinessDeletionProgress;
  readonly now:
    string;
}

export type BusinessDeletionOutcome =
  | "deny-owner-mismatch"
  | "retain-account-open"
  | "retain-closure-pending"
  | "retain-policy-approval"
  | "retain-legal-hold"
  | "retain-minimum-period"
  | "conflict-idempotency-key"
  | "eligible-to-delete"
  | "resume-deletion"
  | "already-deleted";

export interface BusinessDeletionDecision {
  readonly outcome:
    BusinessDeletionOutcome;
  readonly auditEvent:
    BusinessDeletionAuditEvent;
  readonly deleteAuthorized:
    boolean;
  readonly retentionDeadline?:
    string;
  readonly remainingComponents:
    readonly BusinessDeletionComponent[];
  readonly completionRequiresAllComponents:
    true;
  readonly authoritativeRecordTtl:
    "prohibited";
  readonly kmsKeyDeletionSubstitute:
    false;
}

const OWNER_PARTITION_PATTERN =
  /^BUSINESS#OWNER#[A-Za-z0-9_-]{43}$/;

const IDEMPOTENCY_KEY_PATTERN =
  /^del_[A-Za-z0-9_-]{43}$/;

const EVIDENCE_HASH_PATTERN =
  /^[a-f0-9]{64}$/;

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

function timestampNotAfter(
  value:
    string,
  now:
    string,
  name:
    string,
): string {
  const timestamp =
    canonicalTimestamp(
      value,
      name,
    );

  if (
    Date.parse(timestamp) >
    Date.parse(now)
  ) {
    throw new Error(
      `${name} cannot be in the future.`,
    );
  }

  return timestamp;
}

function validatedOwnerPartitionKey(
  value:
    string,
  name:
    string,
): string {
  if (
    typeof value !== "string" ||
    !OWNER_PARTITION_PATTERN.test(
      value,
    )
  ) {
    throw new Error(
      `${name} must be a canonical pseudonymous owner partition.`,
    );
  }

  return value;
}

function validatedIdempotencyKey(
  value:
    string,
): string {
  if (
    typeof value !== "string" ||
    !IDEMPOTENCY_KEY_PATTERN.test(
      value,
    )
  ) {
    throw new Error(
      "A canonical non-sensitive deletion idempotency key is required.",
    );
  }

  return value;
}

function validatedEvidenceHash(
  value:
    string,
  name:
    string,
): string {
  if (
    typeof value !== "string" ||
    !EVIDENCE_HASH_PATTERN.test(
      value,
    )
  ) {
    throw new Error(
      `${name} must be a lowercase SHA-256 evidence reference.`,
    );
  }

  return value;
}

function addUtcCalendarYears(
  value:
    string,
  years:
    number,
): string {
  const date =
    new Date(value);

  date.setUTCFullYear(
    date.getUTCFullYear() +
      years,
  );

  return date.toISOString();
}

function laterTimestamp(
  left:
    string,
  right:
    string,
): string {
  return (
    Date.parse(left) >=
    Date.parse(right)
  )
    ? left
    : right;
}

function frozenComponents(
  components:
    readonly BusinessDeletionComponent[],
): readonly BusinessDeletionComponent[] {
  return Object.freeze([
    ...components,
  ]);
}

function decision(
  outcome:
    BusinessDeletionOutcome,
  auditEvent:
    BusinessDeletionAuditEvent,
  deleteAuthorized:
    boolean,
  remainingComponents:
    readonly BusinessDeletionComponent[],
  retentionDeadline?:
    string,
): BusinessDeletionDecision {
  return Object.freeze({
    outcome,
    auditEvent,
    deleteAuthorized,
    ...(retentionDeadline
      ? {
          retentionDeadline,
        }
      : {}),
    remainingComponents:
      frozenComponents(
        remainingComponents,
      ),
    completionRequiresAllComponents:
      true,
    authoritativeRecordTtl:
      "prohibited",
    kmsKeyDeletionSubstitute:
      false,
  });
}

function validatedAccount(
  account:
    BusinessAccountLifecycle,
  now:
    string,
): BusinessAccountLifecycle {
  if (
    account.status ===
    "open"
  ) {
    return account;
  }

  const requestedAt =
    timestampNotAfter(
      account.requestedAt,
      now,
      "Account closure request time",
    );

  if (
    account.status ===
    "closure-requested"
  ) {
    return Object.freeze({
      status:
        "closure-requested",
      requestedAt,
    });
  }

  const closedAt =
    timestampNotAfter(
      account.closedAt,
      now,
      "Account closure time",
    );

  if (
    Date.parse(closedAt) <
    Date.parse(requestedAt)
  ) {
    throw new Error(
      "Account closure cannot precede its request.",
    );
  }

  return Object.freeze({
    status:
      "closed",
    requestedAt,
    closedAt,
  });
}

function validatedLegalHold(
  legalHold:
    BusinessLegalHold,
  now:
    string,
): BusinessLegalHold {
  if (
    legalHold.status ===
    "none"
  ) {
    return legalHold;
  }

  if (
    ![
      "legal",
      "compliance",
      "regulator",
    ].includes(
      legalHold.authority,
    )
  ) {
    throw new Error(
      "Legal hold authority is unsupported.",
    );
  }

  const startedAt =
    timestampNotAfter(
      legalHold.startedAt,
      now,
      "Legal hold start time",
    );

  const evidenceReferenceHash =
    validatedEvidenceHash(
      legalHold.evidenceReferenceHash,
      "Legal hold evidence",
    );

  if (
    legalHold.status ===
    "active"
  ) {
    return Object.freeze({
      status:
        "active",
      authority:
        legalHold.authority,
      startedAt,
      evidenceReferenceHash,
    });
  }

  const releasedAt =
    timestampNotAfter(
      legalHold.releasedAt,
      now,
      "Legal hold release time",
    );

  if (
    Date.parse(releasedAt) <
    Date.parse(startedAt)
  ) {
    throw new Error(
      "Legal hold release cannot precede its start.",
    );
  }

  return Object.freeze({
    status:
      "released",
    authority:
      legalHold.authority,
    startedAt,
    evidenceReferenceHash,
    releasedAt,
    releaseEvidenceReferenceHash:
      validatedEvidenceHash(
        legalHold
          .releaseEvidenceReferenceHash,
        "Legal hold release evidence",
      ),
  });
}

function validatedPolicyApproval(
  approval:
    BusinessRetentionPolicyApproval,
  now:
    string,
): BusinessRetentionPolicyApproval {
  if (
    approval.status ===
    "pending"
  ) {
    return approval;
  }

  if (
    approval.version !==
    BUSINESS_RETENTION_POLICY_VERSION
  ) {
    throw new Error(
      "Retention policy approval version is unsupported.",
    );
  }

  return Object.freeze({
    status:
      "approved",
    version:
      approval.version,
    approvedAt:
      timestampNotAfter(
        approval.approvedAt,
        now,
        "Retention policy approval time",
      ),
    evidenceReferenceHash:
      validatedEvidenceHash(
        approval.evidenceReferenceHash,
        "Retention policy approval evidence",
      ),
  });
}

function validatedProgress(
  progress:
    BusinessDeletionProgress | undefined,
  now:
    string,
): BusinessDeletionProgress | undefined {
  if (!progress) {
    return undefined;
  }

  const idempotencyKey =
    validatedIdempotencyKey(
      progress.idempotencyKey,
    );

  const deletedComponents =
    frozenComponents(
      progress.deletedComponents,
    );

  if (
    new Set(
      deletedComponents,
    ).size !==
    deletedComponents.length ||
    deletedComponents.some(
      (component) =>
        !BUSINESS_DELETION_COMPONENTS.includes(
          component,
        ),
    )
  ) {
    throw new Error(
      "Deletion progress contains invalid components.",
    );
  }

  const updatedAt =
    timestampNotAfter(
      progress.updatedAt,
      now,
      "Deletion progress update time",
    );

  if (
    progress.state ===
    "in-progress"
  ) {
    if (
      deletedComponents.length ===
      BUSINESS_DELETION_COMPONENTS.length ||
      progress.completedAt !==
        undefined
    ) {
      throw new Error(
        "In-progress deletion cannot be complete.",
      );
    }

    return Object.freeze({
      idempotencyKey,
      state:
        "in-progress",
      deletedComponents,
      updatedAt,
    });
  }

  if (
    deletedComponents.length !==
      BUSINESS_DELETION_COMPONENTS.length ||
    !BUSINESS_DELETION_COMPONENTS.every(
      (component) =>
        deletedComponents.includes(
          component,
        ),
    ) ||
    !progress.completedAt
  ) {
    throw new Error(
      "Completed deletion must verify every component.",
    );
  }

  const completedAt =
    timestampNotAfter(
      progress.completedAt,
      now,
      "Deletion completion time",
    );

  if (
    Date.parse(completedAt) <
    Date.parse(updatedAt)
  ) {
    throw new Error(
      "Deletion completion cannot precede its last update.",
    );
  }

  return Object.freeze({
    idempotencyKey,
    state:
      "completed",
    deletedComponents,
    updatedAt,
    completedAt,
  });
}

export function businessRetentionDeadline(
  recordType:
    BusinessSensitiveRecordType,
  accountClosedAt:
    string,
  recordRetentionAnchorAt:
    string,
): string {
  const policy =
    businessRetentionPolicy(
      recordType,
    );

  const effectiveAnchor =
    laterTimestamp(
      canonicalTimestamp(
        accountClosedAt,
        "Account closure time",
      ),
      canonicalTimestamp(
        recordRetentionAnchorAt,
        "Record retention anchor",
      ),
    );

  return addUtcCalendarYears(
    effectiveAnchor,
    policy.minimumRetentionYears,
  );
}

export function decideBusinessDeletion(
  input:
    BusinessDeletionDecisionInput,
): BusinessDeletionDecision {
  const now =
    canonicalTimestamp(
      input.now,
      "Decision time",
    );

  const authorizedOwnerPartitionKey =
    validatedOwnerPartitionKey(
      input.authorizedOwnerPartitionKey,
      "Authorized owner partition",
    );

  const targetOwnerPartitionKey =
    validatedOwnerPartitionKey(
      input.targetOwnerPartitionKey,
      "Target owner partition",
    );

  const account =
    validatedAccount(
      input.account,
      now,
    );

  const legalHold =
    validatedLegalHold(
      input.legalHold,
      now,
    );

  const policyApproval =
    validatedPolicyApproval(
      input.policyApproval,
      now,
    );

  const requestIdempotencyKey =
    validatedIdempotencyKey(
      input.request.idempotencyKey,
    );

  timestampNotAfter(
    input.request.requestedAt,
    now,
    "Deletion request time",
  );

  const recordRetentionAnchorAt =
    timestampNotAfter(
      input.recordRetentionAnchorAt,
      now,
      "Record retention anchor",
    );

  const progress =
    validatedProgress(
      input.existingProgress,
      now,
    );

  if (
    authorizedOwnerPartitionKey !==
    targetOwnerPartitionKey
  ) {
    return decision(
      "deny-owner-mismatch",
      "business_deletion_denied",
      false,
      [],
    );
  }

  if (
    progress &&
    progress.idempotencyKey !==
      requestIdempotencyKey
  ) {
    return decision(
      "conflict-idempotency-key",
      "business_deletion_conflict",
      false,
      [],
    );
  }

  if (
    progress?.state ===
    "completed"
  ) {
    if (
      legalHold.status ===
      "active"
    ) {
      throw new Error(
        "Completed deletion cannot coexist with an active legal hold.",
      );
    }

    return decision(
      "already-deleted",
      "business_deletion_replayed",
      false,
      [],
    );
  }

  if (
    legalHold.status ===
    "active"
  ) {
    return decision(
      "retain-legal-hold",
      "business_deletion_blocked",
      false,
      progress
        ? BUSINESS_DELETION_COMPONENTS.filter(
            (component) =>
              !progress
                .deletedComponents
                .includes(component),
          )
        : BUSINESS_DELETION_COMPONENTS,
    );
  }

  if (
    policyApproval.status ===
    "pending"
  ) {
    return decision(
      "retain-policy-approval",
      "business_deletion_blocked",
      false,
      [],
    );
  }

  if (
    account.status ===
    "open"
  ) {
    return decision(
      "retain-account-open",
      "business_deletion_blocked",
      false,
      [],
    );
  }

  if (
    account.status ===
    "closure-requested"
  ) {
    return decision(
      "retain-closure-pending",
      "business_deletion_blocked",
      false,
      [],
    );
  }

  const retentionDeadline =
    businessRetentionDeadline(
      input.recordType,
      account.closedAt,
      recordRetentionAnchorAt,
    );

  if (
    Date.parse(now) <
    Date.parse(retentionDeadline)
  ) {
    return decision(
      "retain-minimum-period",
      "business_deletion_blocked",
      false,
      [],
      retentionDeadline,
    );
  }

  if (
    progress?.state ===
    "in-progress"
  ) {
    const remainingComponents =
      BUSINESS_DELETION_COMPONENTS.filter(
        (component) =>
          !progress
            .deletedComponents
            .includes(component),
      );

    return decision(
      "resume-deletion",
      "business_deletion_resumed",
      true,
      remainingComponents,
      retentionDeadline,
    );
  }

  return decision(
    "eligible-to-delete",
    "business_deletion_eligible",
    true,
    BUSINESS_DELETION_COMPONENTS,
    retentionDeadline,
  );
}
