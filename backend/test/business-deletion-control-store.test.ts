import {
  describe,
  expect,
  it,
} from "vitest";
import {
  BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION,
  BUSINESS_DELETION_CONTROL_RETENTION_DAYS,
  BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
  BUSINESS_DELETION_TOPOLOGY_VERSION,
  createBusinessDeletionManifest,
  type BusinessDeletionComponentInput,
  type BusinessDeletionManifest,
} from "../src/business-deletion-execution.js";
import {
  BUSINESS_RETENTION_POLICY_VERSION,
} from "../src/business-retention-lifecycle.js";
import {
  BUSINESS_DELETION_CONTROL_MAX_LEASE_SECONDS,
  BUSINESS_DELETION_CONTROL_PRIVACY_BOUNDARY,
  BUSINESS_DELETION_CONTROL_RECORD_KINDS,
  BUSINESS_DELETION_CONTROL_STATES,
  BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
  BUSINESS_DELETION_CONTROL_STORE_RETENTION_DAYS,
  BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
  BUSINESS_DELETION_CONTROL_TTL_BOUNDARY,
  acquireBusinessDeletionControlLease,
  businessDeletionControlEvidenceKey,
  businessDeletionControlIdempotencyKey,
  businessDeletionControlOperationGuard,
  businessDeletionControlOperationKey,
  businessDeletionControlProgressGuard,
  businessDeletionControlProgressKey,
  createBusinessDeletionControlLegalHoldRecord,
  createBusinessDeletionControlOperation,
  createBusinessDeletionControlProgress,
  createBusinessDeletionControlRetirementMarker,
  createBusinessDeletionControlTerminalEvidence,
  evaluateBusinessDeletionControlIdempotencyClaim,
  recordBusinessDeletionControlProgress,
  retireBusinessDeletionControlIdempotencyClaim,
  transitionBusinessDeletionControlOperation,
} from "../src/business-deletion-control-store.js";

const OPERATION_ID =
  "123e4567-e89b-42d3-a456-426614174000";

const OWNER =
  "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const HASH_A =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const HASH_B =
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const HASH_C =
  "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

const HASH_D =
  "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

const CREATED_AT =
  "2026-08-06T20:00:00.000Z";

const READY_AT =
  "2026-08-06T20:01:00.000Z";

const EXECUTING_AT =
  "2026-08-06T20:02:00.000Z";

const PARTIAL_AT =
  "2026-08-06T20:03:00.000Z";

const COMPLETED_AT =
  "2026-08-06T20:04:00.000Z";

function dynamoComponent(
  componentId:
    string,
  role:
    "ciphertext-primary" |
    "derived-index" =
      "derived-index",
): BusinessDeletionComponentInput {
  return {
    componentId,
    role,
    locator: {
      system:
        "dynamodb",
      tableRole:
        "business-table",
      awsAccountId:
        "123456789012",
      awsRegion:
        "us-east-1",
      partitionKey:
        OWNER,
      sortKey:
        `BUSINESS#SENSITIVE#${componentId}`,
      itemGenerationPrecondition: {
        mode:
          "exact-generation-or-absent",
        partitionKeyAttributeName:
          "pk",
        sortKeyAttributeName:
          "sk",
        generationAttributeName:
          "deletionGuardDigest",
        expectedGenerationDigest:
          HASH_A,
      },
      estimatedItemBytes:
        1024,
    },
  };
}

function manifest(
  input:
    Partial<{
      legalHoldStatus:
        "inactive" |
        "active";
      legalHoldVersion:
        number;
    }> = {},
): BusinessDeletionManifest {
  return createBusinessDeletionManifest({
    operationId:
      OPERATION_ID,
    authorizedOwnerPartitionKey:
      OWNER,
    targetOwnerPartitionKey:
      OWNER,
    recordType:
      "banking-instrument",
    recordContextDigest:
      HASH_A,
    policyVersion:
      BUSINESS_RETENTION_POLICY_VERSION,
    topologyVersion:
      BUSINESS_DELETION_TOPOLOGY_VERSION,
    idempotencyKeyDigest:
      HASH_B,
    legalHoldSnapshot: {
      status:
        input.legalHoldStatus ??
        "inactive",
      authority:
        "compliance-control",
      version:
        input.legalHoldVersion ??
        7,
      observedAt:
        CREATED_AT,
      evidenceReferenceHash:
        HASH_C,
    },
    createdAt:
      CREATED_AT,
    components: [
      dynamoComponent(
        "ciphertext-primary",
        "ciphertext-primary",
      ),
      dynamoComponent(
        "derived-index-01",
      ),
    ],
  });
}

function readyOperation() {
  const created =
    createBusinessDeletionControlOperation(
      manifest(),
      CREATED_AT,
    );

  return transitionBusinessDeletionControlOperation(
    created,
    {
      expectedStateVersion:
        created.stateVersion,
      targetState:
        "ready",
      legalHoldSnapshot:
        manifest().legalHoldSnapshot,
      completedComponentCount:
        0,
      updatedAt:
        READY_AT,
    },
  );
}

function executingOperation() {
  const ready =
    readyOperation();

  return transitionBusinessDeletionControlOperation(
    ready,
    {
      expectedStateVersion:
        ready.stateVersion,
      targetState:
        "executing",
      legalHoldSnapshot:
        manifest().legalHoldSnapshot,
      completedComponentCount:
        0,
      updatedAt:
        EXECUTING_AT,
    },
  );
}

function completedOperation() {
  const executing =
    executingOperation();

  return transitionBusinessDeletionControlOperation(
    executing,
    {
      expectedStateVersion:
        executing.stateVersion,
      targetState:
        "completed",
      legalHoldSnapshot:
        manifest().legalHoldSnapshot,
      completedComponentCount:
        2,
      updatedAt:
        COMPLETED_AT,
    },
  );
}

describe(
  "deletion control store contracts",
  () => {
    it(
      "publishes reviewed state, retention, and privacy boundaries",
      () => {
        expect(
          BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
        ).toBe(1);

        expect(
          BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
        ).toBe(1);

        expect(
          BUSINESS_DELETION_CONTROL_STORE_RETENTION_DAYS,
        ).toBe(
          BUSINESS_DELETION_CONTROL_RETENTION_DAYS,
        );

        expect(
          BUSINESS_DELETION_CONTROL_MAX_LEASE_SECONDS,
        ).toBe(900);

        expect(
          BUSINESS_DELETION_CONTROL_STATES,
        ).toEqual([
          "planned",
          "blocked-legal-hold",
          "ready",
          "executing",
          "partially-complete",
          "completed",
          "failed-closed",
          "retired",
        ]);

        expect(
          BUSINESS_DELETION_CONTROL_RECORD_KINDS,
        ).toContain(
          "terminal-evidence",
        );

        expect(
          BUSINESS_DELETION_CONTROL_TTL_BOUNDARY,
        ).toEqual({
          transientControlRecords:
            "cleanup-only-after-reviewed-retention",
          terminalEvidence:
            "audit-policy-retained",
          proofOfDeletion:
            false,
        });

        expect(
          BUSINESS_DELETION_CONTROL_PRIVACY_BOUNDARY,
        ).toMatchObject({
          rawOwnerId:
            "prohibited",
          businessRecordId:
            "prohibited",
          rawBusinessLocator:
            "prohibited",
          ciphertext:
            "prohibited",
          rawIdempotencyKey:
            "prohibited",
          workerDiscovery:
            "no-scan",
        });
      },
    );

    it(
      "uses random-operation and pseudonymous idempotency partitions",
      () => {
        expect(
          businessDeletionControlOperationKey(
            OPERATION_ID,
          ),
        ).toEqual({
          pk:
            `DEL#OP#${OPERATION_ID}`,
          sk:
            "ROOT",
        });

        expect(
          businessDeletionControlIdempotencyKey(
            HASH_D,
          ),
        ).toEqual({
          pk:
            `DEL#IDEM#${HASH_D}`,
          sk:
            "CLAIM",
        });

        expect(
          businessDeletionControlProgressKey(
            OPERATION_ID,
            3,
          ),
        ).toEqual({
          pk:
            `DEL#OP#${OPERATION_ID}`,
          sk:
            "STEP#000003",
        });

        expect(
          businessDeletionControlEvidenceKey(
            OPERATION_ID,
          ),
        ).toEqual({
          pk:
            `DEL#OP#${OPERATION_ID}`,
          sk:
            "EVIDENCE",
        });
      },
    );

    it(
      "rejects malformed operation IDs and request digests",
      () => {
        expect(
          () =>
            businessDeletionControlOperationKey(
              "not-an-operation",
            ),
        ).toThrow(
          "lowercase UUID v4",
        );

        expect(
          () =>
            businessDeletionControlIdempotencyKey(
              "not-a-digest",
            ),
        ).toThrow(
          "lowercase SHA-256",
        );
      },
    );

    it(
      "creates a planned operation with no customer identifiers or locators",
      () => {
        const value =
          createBusinessDeletionControlOperation(
            manifest(),
            CREATED_AT,
          );

        expect(
          value,
        ).toMatchObject({
          kind:
            "operation-root",
          operationId:
            OPERATION_ID,
          state:
            "planned",
          stateVersion:
            1,
          legalHoldStatus:
            "inactive",
          legalHoldVersion:
            7,
          completedComponentCount:
            0,
        });

        const serialized =
          JSON.stringify(
            value,
          );

        expect(
          serialized,
        ).not.toContain(
          OWNER,
        );

        expect(
          serialized,
        ).not.toContain(
          "BUSINESS#SENSITIVE",
        );
      },
    );

    it(
      "starts active-hold operations blocked",
      () => {
        const value =
          createBusinessDeletionControlOperation(
            manifest({
              legalHoldStatus:
                "active",
            }),
            CREATED_AT,
          );

        expect(
          value.state,
        ).toBe(
          "blocked-legal-hold",
        );
      },
    );

    it(
      "rejects a control operation before manifest creation",
      () => {
        expect(
          () =>
            createBusinessDeletionControlOperation(
              manifest(),
              "2026-08-06T19:59:59.000Z",
            ),
        ).toThrow(
          "cannot precede manifest creation",
        );
      },
    );

    it(
      "stores versioned legal-hold evidence without owner or record identifiers",
      () => {
        const operation =
          createBusinessDeletionControlOperation(
            manifest(),
            CREATED_AT,
          );

        const value =
          createBusinessDeletionControlLegalHoldRecord(
            operation,
            {
              ...manifest()
                .legalHoldSnapshot,
              version:
                8,
              observedAt:
                READY_AT,
            },
          );

        expect(
          value,
        ).toMatchObject({
          kind:
            "legal-hold-snapshot",
          status:
            "inactive",
          version:
            8,
          evidenceReferenceHash:
            HASH_C,
        });

        expect(
          JSON.stringify(value),
        ).not.toContain(
          OWNER,
        );
      },
    );

    it(
      "rejects legal-hold version rollback",
      () => {
        const operation =
          createBusinessDeletionControlOperation(
            manifest({
              legalHoldVersion:
                7,
            }),
            CREATED_AT,
          );

        expect(
          () =>
            createBusinessDeletionControlLegalHoldRecord(
              operation,
              {
                ...manifest()
                  .legalHoldSnapshot,
                version:
                  6,
              },
            ),
        ).toThrow(
          "cannot move backward",
        );
      },
    );

    it(
      "publishes exact versioned operation mutation guards",
      () => {
        const operation =
          readyOperation();

        expect(
          businessDeletionControlOperationGuard(
            operation,
          ),
        ).toEqual({
          operationId:
            OPERATION_ID,
          expectedState:
            "ready",
          expectedStateVersion:
            2,
          expectedLegalHoldVersion:
            7,
        });
      },
    );

    it(
      "allows only explicit operation state transitions",
      () => {
        const operation =
          createBusinessDeletionControlOperation(
            manifest(),
            CREATED_AT,
          );

        expect(
          () =>
            transitionBusinessDeletionControlOperation(
              operation,
              {
                expectedStateVersion:
                  1,
                targetState:
                  "completed",
                legalHoldSnapshot:
                  manifest()
                    .legalHoldSnapshot,
                completedComponentCount:
                  2,
                updatedAt:
                  READY_AT,
              },
            ),
        ).toThrow(
          "transition is not allowed",
        );
      },
    );

    it(
      "fails closed on stale state versions",
      () => {
        const operation =
          readyOperation();

        expect(
          () =>
            transitionBusinessDeletionControlOperation(
              operation,
              {
                expectedStateVersion:
                  1,
                targetState:
                  "executing",
                legalHoldSnapshot:
                  manifest()
                    .legalHoldSnapshot,
                completedComponentCount:
                  0,
                updatedAt:
                  EXECUTING_AT,
              },
            ),
        ).toThrow(
          "state version conflict",
        );
      },
    );

    it(
      "blocks executable states under an active legal hold",
      () => {
        const operation =
          readyOperation();

        expect(
          () =>
            transitionBusinessDeletionControlOperation(
              operation,
              {
                expectedStateVersion:
                  operation.stateVersion,
                targetState:
                  "executing",
                legalHoldSnapshot: {
                  ...manifest()
                    .legalHoldSnapshot,
                  status:
                    "active",
                  version:
                    8,
                  observedAt:
                    EXECUTING_AT,
                },
                completedComponentCount:
                  0,
                updatedAt:
                  EXECUTING_AT,
              },
            ),
        ).toThrow(
          "require an inactive legal hold",
        );
      },
    );

    it(
      "permits a concurrent legal hold to block execution",
      () => {
        const operation =
          executingOperation();

        const blocked =
          transitionBusinessDeletionControlOperation(
            operation,
            {
              expectedStateVersion:
                operation.stateVersion,
              targetState:
                "blocked-legal-hold",
              legalHoldSnapshot: {
                ...manifest()
                  .legalHoldSnapshot,
                status:
                  "active",
                version:
                  8,
                observedAt:
                  PARTIAL_AT,
              },
              completedComponentCount:
                0,
              updatedAt:
                PARTIAL_AT,
            },
          );

        expect(
          blocked.state,
        ).toBe(
          "blocked-legal-hold",
        );

        expect(
          blocked.legalHoldVersion,
        ).toBe(8);
      },
    );

    it(
      "requires monotonic component completion",
      () => {
        const executing =
          executingOperation();

        const partial =
          transitionBusinessDeletionControlOperation(
            executing,
            {
              expectedStateVersion:
                executing.stateVersion,
              targetState:
                "partially-complete",
              legalHoldSnapshot:
                manifest()
                  .legalHoldSnapshot,
              completedComponentCount:
                1,
              updatedAt:
                PARTIAL_AT,
            },
          );

        expect(
          () =>
            transitionBusinessDeletionControlOperation(
              partial,
              {
                expectedStateVersion:
                  partial.stateVersion,
                targetState:
                  "executing",
                legalHoldSnapshot:
                  manifest()
                    .legalHoldSnapshot,
                completedComponentCount:
                  0,
                updatedAt:
                  COMPLETED_AT,
              },
            ),
        ).toThrow(
          "progress cannot decrease",
        );
      },
    );

    it(
      "requires all components before completed state",
      () => {
        const executing =
          executingOperation();

        expect(
          () =>
            transitionBusinessDeletionControlOperation(
              executing,
              {
                expectedStateVersion:
                  executing.stateVersion,
                targetState:
                  "completed",
                legalHoldSnapshot:
                  manifest()
                    .legalHoldSnapshot,
                completedComponentCount:
                  1,
                updatedAt:
                  COMPLETED_AT,
              },
            ),
        ).toThrow(
          "requires every manifest component",
        );
      },
    );

    it(
      "binds terminal retention to ninety days after terminal state",
      () => {
        const completed =
          completedOperation();

        expect(
          completed.terminalAt,
        ).toBe(
          COMPLETED_AT,
        );

        expect(
          completed.retireAfter,
        ).toBe(
          "2026-11-04T20:04:00.000Z",
        );
      },
    );

    it(
      "prevents early retirement",
      () => {
        const completed =
          completedOperation();

        expect(
          () =>
            transitionBusinessDeletionControlOperation(
              completed,
              {
                expectedStateVersion:
                  completed.stateVersion,
                targetState:
                  "retired",
                legalHoldSnapshot:
                  manifest()
                    .legalHoldSnapshot,
                completedComponentCount:
                  2,
                updatedAt:
                  "2026-11-04T20:03:59.000Z",
              },
            ),
        ).toThrow(
          "cannot retire before",
        );
      },
    );

    it(
      "allows retirement only after the control retention boundary",
      () => {
        const completed =
          completedOperation();

        const retired =
          transitionBusinessDeletionControlOperation(
            completed,
            {
              expectedStateVersion:
                completed.stateVersion,
              targetState:
                "retired",
              legalHoldSnapshot:
                manifest()
                  .legalHoldSnapshot,
              completedComponentCount:
                2,
              updatedAt:
                "2026-11-04T20:04:00.000Z",
            },
          );

        expect(
          retired.state,
        ).toBe(
          "retired",
        );
      },
    );

    it(
      "creates domain-separated pseudonymous idempotency claims",
      () => {
        const decision =
          evaluateBusinessDeletionControlIdempotencyClaim(
            undefined,
            manifest(),
            HASH_D,
            CREATED_AT,
          );

        expect(
          decision.outcome,
        ).toBe(
          "create",
        );

        if (
          decision.outcome ===
          "create"
        ) {
          expect(
            decision.claim,
          ).toMatchObject({
            pseudonymousRequestDigest:
              HASH_D,
            operationId:
              OPERATION_ID,
            stateVersion:
              1,
          });
        }
      },
    );

    it(
      "rejects copying the manifest idempotency digest into the control key",
      () => {
        expect(
          () =>
            evaluateBusinessDeletionControlIdempotencyClaim(
              undefined,
              manifest(),
              HASH_B,
              CREATED_AT,
            ),
        ).toThrow(
          "domain-separated",
        );
      },
    );

    it(
      "treats the same idempotency binding as replay",
      () => {
        const created =
          evaluateBusinessDeletionControlIdempotencyClaim(
            undefined,
            manifest(),
            HASH_D,
            CREATED_AT,
          );

        if (
          created.outcome !==
          "create"
        ) {
          throw new Error(
            "Expected idempotency creation.",
          );
        }

        const replay =
          evaluateBusinessDeletionControlIdempotencyClaim(
            created.claim,
            manifest(),
            HASH_D,
            READY_AT,
          );

        expect(
          replay.outcome,
        ).toBe(
          "replay",
        );
      },
    );

    it(
      "conflicts a pseudonymous digest bound to another operation",
      () => {
        const created =
          evaluateBusinessDeletionControlIdempotencyClaim(
            undefined,
            manifest(),
            HASH_D,
            CREATED_AT,
          );

        if (
          created.outcome !==
          "create"
        ) {
          throw new Error(
            "Expected idempotency creation.",
          );
        }

        const conflicting =
          Object.freeze({
            ...created.claim,
            operationId:
              "223e4567-e89b-42d3-a456-426614174000",
          });

        const decision =
          evaluateBusinessDeletionControlIdempotencyClaim(
            conflicting,
            manifest(),
            HASH_D,
            READY_AT,
          );

        expect(
          decision,
        ).toEqual({
          outcome:
            "conflict",
        });
      },
    );

    it(
      "retires idempotency claims with cleanup-only TTL metadata",
      () => {
        const created =
          evaluateBusinessDeletionControlIdempotencyClaim(
            undefined,
            manifest(),
            HASH_D,
            CREATED_AT,
          );

        if (
          created.outcome !==
          "create"
        ) {
          throw new Error(
            "Expected idempotency creation.",
          );
        }

        const retired =
          retireBusinessDeletionControlIdempotencyClaim(
            created.claim,
            COMPLETED_AT,
          );

        expect(
          retired,
        ).toMatchObject({
          terminalAt:
            COMPLETED_AT,
          expireAfter:
            "2026-11-04T20:04:00.000Z",
          ttlPurpose:
            "cleanup-only-not-deletion-proof",
          stateVersion:
            2,
        });

        expect(
          retired.ttlEpochSeconds,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "creates progress records with digests and counts rather than component locators",
      () => {
        const progress =
          createBusinessDeletionControlProgress(
            readyOperation(),
            1,
            HASH_A,
            2,
            READY_AT,
          );

        expect(
          progress,
        ).toMatchObject({
          kind:
            "progress",
          stepIndex:
            1,
          componentRangeDigest:
            HASH_A,
          expectedComponentCount:
            2,
          completedComponentCount:
            0,
          state:
            "pending",
          attemptCount:
            0,
          leaseVersion:
            0,
        });

        expect(
          JSON.stringify(progress),
        ).not.toContain(
          OWNER,
        );
      },
    );

    it(
      "publishes progress mutation guards",
      () => {
        const progress =
          createBusinessDeletionControlProgress(
            readyOperation(),
            1,
            HASH_A,
            2,
            READY_AT,
          );

        expect(
          businessDeletionControlProgressGuard(
            progress,
          ),
        ).toEqual({
          operationId:
            OPERATION_ID,
          stepIndex:
            1,
          expectedState:
            "pending",
          expectedStateVersion:
            1,
          expectedLeaseVersion:
            0,
        });
      },
    );

    it(
      "acquires bounded versioned leases and increments attempts",
      () => {
        const progress =
          createBusinessDeletionControlProgress(
            readyOperation(),
            1,
            HASH_A,
            2,
            READY_AT,
          );

        const leased =
          acquireBusinessDeletionControlLease(
            progress,
            progress.stateVersion,
            HASH_D,
            EXECUTING_AT,
            "2026-08-06T20:17:00.000Z",
          );

        expect(
          leased,
        ).toMatchObject({
          state:
            "executing",
          stateVersion:
            2,
          attemptCount:
            1,
          leaseVersion:
            1,
          lease: {
            tokenDigest:
              HASH_D,
            version:
              1,
          },
        });
      },
    );

    it(
      "rejects overlong and unexpired lease takeover",
      () => {
        const progress =
          createBusinessDeletionControlProgress(
            readyOperation(),
            1,
            HASH_A,
            2,
            READY_AT,
          );

        expect(
          () =>
            acquireBusinessDeletionControlLease(
              progress,
              progress.stateVersion,
              HASH_D,
              EXECUTING_AT,
              "2026-08-06T20:17:01.000Z",
            ),
        ).toThrow(
          "exceeds the supported duration",
        );

        const leased =
          acquireBusinessDeletionControlLease(
            progress,
            progress.stateVersion,
            HASH_D,
            EXECUTING_AT,
            "2026-08-06T20:17:00.000Z",
          );

        expect(
          () =>
            acquireBusinessDeletionControlLease(
              leased,
              leased.stateVersion,
              HASH_C,
              PARTIAL_AT,
              "2026-08-06T20:18:00.000Z",
            ),
        ).toThrow(
          "unexpired deletion lease",
        );
      },
    );

    it(
      "permits takeover after lease expiry with a new version",
      () => {
        const progress =
          createBusinessDeletionControlProgress(
            readyOperation(),
            1,
            HASH_A,
            2,
            READY_AT,
          );

        const first =
          acquireBusinessDeletionControlLease(
            progress,
            progress.stateVersion,
            HASH_D,
            EXECUTING_AT,
            "2026-08-06T20:03:00.000Z",
          );

        const takeover =
          acquireBusinessDeletionControlLease(
            first,
            first.stateVersion,
            HASH_C,
            "2026-08-06T20:03:00.000Z",
            "2026-08-06T20:18:00.000Z",
          );

        expect(
          takeover,
        ).toMatchObject({
          attemptCount:
            2,
          leaseVersion:
            2,
          lease: {
            tokenDigest:
              HASH_C,
            version:
              2,
          },
        });
      },
    );

    it(
      "requires the current lease token to advance progress",
      () => {
        const progress =
          createBusinessDeletionControlProgress(
            readyOperation(),
            1,
            HASH_A,
            2,
            READY_AT,
          );

        const leased =
          acquireBusinessDeletionControlLease(
            progress,
            progress.stateVersion,
            HASH_D,
            EXECUTING_AT,
            "2026-08-06T20:17:00.000Z",
          );

        expect(
          () =>
            recordBusinessDeletionControlProgress(
              leased,
              leased.stateVersion,
              HASH_C,
              1,
              PARTIAL_AT,
            ),
        ).toThrow(
          "lease token conflict",
        );
      },
    );

    it(
      "advances leased progress monotonically and completes exactly",
      () => {
        const progress =
          createBusinessDeletionControlProgress(
            readyOperation(),
            1,
            HASH_A,
            2,
            READY_AT,
          );

        const leased =
          acquireBusinessDeletionControlLease(
            progress,
            progress.stateVersion,
            HASH_D,
            EXECUTING_AT,
            "2026-08-06T20:17:00.000Z",
          );

        const partial =
          recordBusinessDeletionControlProgress(
            leased,
            leased.stateVersion,
            HASH_D,
            1,
            PARTIAL_AT,
          );

        expect(
          partial.completedComponentCount,
        ).toBe(1);

        expect(
          () =>
            recordBusinessDeletionControlProgress(
              partial,
              partial.stateVersion,
              HASH_D,
              0,
              COMPLETED_AT,
            ),
        ).toThrow(
          "progress cannot decrease",
        );

        const completed =
          recordBusinessDeletionControlProgress(
            partial,
            partial.stateVersion,
            HASH_D,
            2,
            COMPLETED_AT,
          );

        expect(
          completed,
        ).toMatchObject({
          state:
            "completed",
          completedComponentCount:
            2,
          completedAt:
            COMPLETED_AT,
        });

        expect(
          completed.lease,
        ).toBeUndefined();
      },
    );

    it(
      "creates sanitized terminal evidence bound to the completed operation",
      () => {
        const operation =
          completedOperation();

        const evidence =
          createBusinessDeletionControlTerminalEvidence(
            operation,
            {
              schemaVersion:
                BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
              operationId:
                OPERATION_ID,
              policyVersion:
                BUSINESS_RETENTION_POLICY_VERSION,
              topologyVersion:
                BUSINESS_DELETION_TOPOLOGY_VERSION,
              manifestIntegrityDigest:
                operation.manifestIntegrityDigest,
              expectedComponentCount:
                2,
              deletedComponentCount:
                2,
              completedAt:
                COMPLETED_AT,
              outcome:
                "active-store-components-deleted",
              backupDisclosureVersion:
                BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION,
              backupDisclosure:
                "active-store-only-pitr-backups-and-exports-may-retain-until-expiry",
            },
          );

        expect(
          evidence,
        ).toMatchObject({
          kind:
            "terminal-evidence",
          operationId:
            OPERATION_ID,
          deletedComponentCount:
            2,
          retentionMode:
            "audit-policy-retained",
        });

        const serialized =
          JSON.stringify(
            evidence,
          );

        expect(
          serialized,
        ).not.toContain(
          OWNER,
        );

        expect(
          serialized,
        ).not.toContain(
          HASH_B,
        );
      },
    );

    it(
      "rejects terminal evidence that does not match the control operation",
      () => {
        const operation =
          completedOperation();

        expect(
          () =>
            createBusinessDeletionControlTerminalEvidence(
              operation,
              {
                schemaVersion:
                  BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
                operationId:
                  OPERATION_ID,
                policyVersion:
                  BUSINESS_RETENTION_POLICY_VERSION,
                topologyVersion:
                  BUSINESS_DELETION_TOPOLOGY_VERSION,
                manifestIntegrityDigest:
                  operation.manifestIntegrityDigest,
                expectedComponentCount:
                  2,
                deletedComponentCount:
                  1,
                completedAt:
                  COMPLETED_AT,
                outcome:
                  "active-store-components-deleted",
                backupDisclosureVersion:
                  BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION,
                backupDisclosure:
                  "active-store-only-pitr-backups-and-exports-may-retain-until-expiry",
              },
            ),
        ).toThrow(
          "does not match",
        );
      },
    );

    it(
      "creates cleanup-only retirement markers for transient control records",
      () => {
        const operation =
          completedOperation();

        const marker =
          createBusinessDeletionControlRetirementMarker(
            operation,
          );

        expect(
          marker,
        ).toMatchObject({
          kind:
            "retirement-marker",
          terminalAt:
            COMPLETED_AT,
          retireAfter:
            "2026-11-04T20:04:00.000Z",
          scope:
            "transient-control-records-only",
          ttlPurpose:
            "cleanup-only-not-deletion-proof",
        });

        expect(
          marker.ttlEpochSeconds,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "freezes emitted control records",
      () => {
        const operation =
          createBusinessDeletionControlOperation(
            manifest(),
            CREATED_AT,
          );

        const hold =
          createBusinessDeletionControlLegalHoldRecord(
            operation,
            manifest()
              .legalHoldSnapshot,
          );

        const progress =
          createBusinessDeletionControlProgress(
            readyOperation(),
            1,
            HASH_A,
            2,
            READY_AT,
          );

        expect(
          Object.isFrozen(operation),
        ).toBe(true);

        expect(
          Object.isFrozen(hold),
        ).toBe(true);

        expect(
          Object.isFrozen(progress),
        ).toBe(true);
      },
    );
  },
);
