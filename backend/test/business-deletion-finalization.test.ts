import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BUSINESS_DELETION_TOPOLOGY_VERSION,
  createBusinessDeletionManifest,
  planBusinessDeletionExecution,
  type BusinessDeletionComponentInput,
  type BusinessDeletionManifest,
} from "../src/business-deletion-execution.js";
import {
  BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
  BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
  createBusinessDeletionControlOperation,
  transitionBusinessDeletionControlOperation,
  type BusinessDeletionControlOperationMutationGuard,
  type BusinessDeletionControlOperationRoot,
  type BusinessDeletionControlProgressRecord,
  type BusinessDeletionControlTerminalEvidenceRecord,
} from "../src/business-deletion-control-store.js";
import {
  BUSINESS_RETENTION_POLICY_VERSION,
} from "../src/business-retention-lifecycle.js";
import {
  businessDeletionStepComponentRangeDigest,
} from "../src/business-deletion-orchestration.js";
import {
  BUSINESS_DELETION_FINALIZATION_BOUNDARY,
  BUSINESS_DELETION_FINALIZATION_SCHEMA_VERSION,
  finalizeBusinessDeletionExecution,
  type BusinessDeletionFinalizationPersistence,
} from "../src/business-deletion-finalization.js";

const OPERATION_ID =
  "123e4567-e89b-42d3-a456-426614174000";

const OWNER =
  "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const HASH_A =
  "a".repeat(64);

const HASH_B =
  "b".repeat(64);

const HASH_C =
  "c".repeat(64);

const CREATED_AT =
  "2026-08-08T12:00:00.000Z";

const READY_AT =
  "2026-08-08T12:01:00.000Z";

const EXECUTING_AT =
  "2026-08-08T12:02:00.000Z";

const COMPLETED_AT =
  "2026-08-08T12:03:00.000Z";

function dynamoComponent(
  componentId:
    string,
  role:
    | "ciphertext-primary"
    | "primary-index"
    | "derived-index" =
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

function partialOperation(
  value =
    manifest(),
): BusinessDeletionControlOperationRoot {
  const created =
    createBusinessDeletionControlOperation(
      value,
      CREATED_AT,
    );

  const ready =
    transitionBusinessDeletionControlOperation(
      created,
      {
        expectedStateVersion:
          created.stateVersion,
        targetState:
          "ready",
        legalHoldSnapshot:
          value.legalHoldSnapshot,
        completedComponentCount:
          0,
        updatedAt:
          READY_AT,
      },
    );

  const executing =
    transitionBusinessDeletionControlOperation(
      ready,
      {
        expectedStateVersion:
          ready.stateVersion,
        targetState:
          "executing",
        legalHoldSnapshot:
          value.legalHoldSnapshot,
        completedComponentCount:
          0,
        updatedAt:
          EXECUTING_AT,
      },
    );

  return transitionBusinessDeletionControlOperation(
    executing,
    {
      expectedStateVersion:
        executing.stateVersion,
      targetState:
        "partially-complete",
      legalHoldSnapshot:
        value.legalHoldSnapshot,
      completedComponentCount:
        value.expectedComponentCount,
      updatedAt:
        COMPLETED_AT,
    },
  );
}

function completedProgress(
  value =
    manifest(),
): BusinessDeletionControlProgressRecord {
  const plan =
    planBusinessDeletionExecution(
      value,
    );

  if (
    plan.mode ===
    "blocked-legal-hold"
  ) {
    throw new Error(
      "Expected executable deletion plan.",
    );
  }

  const step =
    plan.steps[0];

  if (!step) {
    throw new Error(
      "Expected one deletion step.",
    );
  }

  return Object.freeze({
    pk:
      `DEL#OP#${value.operationId}`,
    sk:
      "STEP#000001",
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "progress",
    operationId:
      value.operationId,
    manifestIntegrityDigest:
      value.manifestIntegrityDigest,
    stepIndex:
      1,
    componentRangeDigest:
      businessDeletionStepComponentRangeDigest(
        step,
      ),
    expectedComponentCount:
      step.componentIds.length,
    completedComponentCount:
      step.componentIds.length,
    state:
      "completed",
    stateVersion:
      3,
    attemptCount:
      1,
    leaseVersion:
      1,
    createdAt:
      EXECUTING_AT,
    updatedAt:
      COMPLETED_AT,
    completedAt:
      COMPLETED_AT,
  });
}

class MemoryPersistence
  implements BusinessDeletionFinalizationPersistence {
  operation:
    BusinessDeletionControlOperationRoot;

  readonly progress =
    new Map<
      number,
      BusinessDeletionControlProgressRecord
    >();

  terminalEvidence:
    BusinessDeletionControlTerminalEvidenceRecord |
    null =
      null;

  readonly progressReads =
    new Array<number>();

  readonly finalizations =
    new Array<{
      guard:
        BusinessDeletionControlOperationMutationGuard;
      next:
        BusinessDeletionControlOperationRoot;
      evidence:
        BusinessDeletionControlTerminalEvidenceRecord;
    }>();

  commitThenThrow =
    false;

  throwWithoutCommit =
    false;

  constructor(
    operation:
      BusinessDeletionControlOperationRoot,
  ) {
    this.operation =
      operation;
  }

  async getOperation(
    operationId:
      string,
  ) {
    return operationId ===
      this.operation.operationId
      ? this.operation
      : null;
  }

  async getProgress(
    operationId:
      string,
    stepIndex:
      number,
  ) {
    this.progressReads.push(
      stepIndex,
    );

    if (
      operationId !==
      this.operation.operationId
    ) {
      return null;
    }

    return (
      this.progress.get(
        stepIndex,
      ) ??
      null
    );
  }

  async getTerminalEvidence(
    operationId:
      string,
  ) {
    return operationId ===
      this.operation.operationId
      ? this.terminalEvidence
      : null;
  }

  async finalizeOperationAndTerminalEvidence(
    guard:
      BusinessDeletionControlOperationMutationGuard,
    next:
      BusinessDeletionControlOperationRoot,
    evidence:
      BusinessDeletionControlTerminalEvidenceRecord,
  ) {
    if (this.throwWithoutCommit) {
      throw new Error(
        "simulated persistence unavailable",
      );
    }

    this.finalizations.push({
      guard,
      next,
      evidence,
    });

    this.operation =
      next;

    this.terminalEvidence =
      evidence;

    if (this.commitThenThrow) {
      throw new Error(
        "simulated lost response",
      );
    }
  }
}

function readyPersistence(
  value =
    manifest(),
): MemoryPersistence {
  const persistence =
    new MemoryPersistence(
      partialOperation(
        value,
      ),
    );

  persistence.progress.set(
    1,
    completedProgress(
      value,
    ),
  );

  return persistence;
}

describe(
  "deletion execution finalization",
  () => {
    it("publishes a narrow crash-safe boundary without wiring runtime surfaces", () => {
      expect(
        BUSINESS_DELETION_FINALIZATION_SCHEMA_VERSION,
      ).toBe(1);

      expect(
        BUSINESS_DELETION_FINALIZATION_BOUNDARY,
      ).toEqual({
        persistence:
          "dependency-injected-exact-key-and-atomic-finalize",
        operationDiscovery:
          "exact-operation-id-only",
        progressDiscovery:
          "deterministic-plan-step-indexes-only",
        terminalEvidenceRead:
          "exact-key",
        terminalWrite:
          "atomic-with-operation-completion",
        retryReconciliation:
          "exact-operation-plus-terminal-evidence",
        actualBusinessDelete:
          false,
        handlerWiring:
          false,
        api:
          false,
        queue:
          false,
        worker:
          false,
        infrastructureChange:
          false,
      });
    });

    it("atomically finalizes only after every planned step is completed", async () => {
      const value =
        manifest();

      const persistence =
        readyPersistence(
          value,
        );

      const result =
        await finalizeBusinessDeletionExecution(
          {
            persistence,
          },
          {
            manifest:
              value,
          },
        );

      expect(result).toEqual({
        schemaVersion:
          1,
        outcome:
          "finalized",
        operationId:
          OPERATION_ID,
        completedComponentCount:
          2,
        expectedComponentCount:
          2,
        completedAt:
          COMPLETED_AT,
      });

      expect(
        persistence.progressReads,
      ).toEqual([1]);

      expect(
        persistence.finalizations,
      ).toHaveLength(1);

      expect(
        persistence.finalizations[0]?.guard,
      ).toEqual({
        operationId:
          OPERATION_ID,
        expectedState:
          "partially-complete",
        expectedStateVersion:
          4,
        expectedLegalHoldVersion:
          7,
      });

      expect(
        persistence.operation.state,
      ).toBe(
        "completed",
      );

      expect(
        persistence.terminalEvidence,
      ).toMatchObject({
        operationId:
          OPERATION_ID,
        deletedComponentCount:
          2,
        completedAt:
          COMPLETED_AT,
        outcome:
          "active-store-components-deleted",
      });
    });

    it("replays an exact completed operation and terminal evidence without a second write", async () => {
      const value =
        manifest();

      const persistence =
        readyPersistence(
          value,
        );

      await finalizeBusinessDeletionExecution(
        {
          persistence,
        },
        {
          manifest:
            value,
        },
      );

      const replay =
        await finalizeBusinessDeletionExecution(
          {
            persistence,
          },
          {
            manifest:
              value,
          },
        );

      expect(
        replay.outcome,
      ).toBe(
        "already-finalized",
      );

      expect(
        persistence.finalizations,
      ).toHaveLength(1);
    });

    it("reconciles a lost transaction response only when both exact terminal records are present", async () => {
      const value =
        manifest();

      const persistence =
        readyPersistence(
          value,
        );

      persistence.commitThenThrow =
        true;

      const result =
        await finalizeBusinessDeletionExecution(
          {
            persistence,
          },
          {
            manifest:
              value,
          },
        );

      expect(
        result.outcome,
      ).toBe(
        "already-finalized",
      );

      expect(
        persistence.operation.state,
      ).toBe(
        "completed",
      );

      expect(
        persistence.terminalEvidence,
      ).not.toBeNull();
    });

    it("propagates an unavailable write when exact reconciliation proves nothing committed", async () => {
      const value =
        manifest();

      const persistence =
        readyPersistence(
          value,
        );

      persistence.throwWithoutCommit =
        true;

      await expect(
        finalizeBusinessDeletionExecution(
          {
            persistence,
          },
          {
            manifest:
              value,
          },
        ),
      ).rejects.toThrow(
        "simulated persistence unavailable",
      );

      expect(
        persistence.operation.state,
      ).toBe(
        "partially-complete",
      );

      expect(
        persistence.terminalEvidence,
      ).toBeNull();
    });

    it("fails closed when any deterministic plan step lacks completed progress", async () => {
      const value =
        manifest();

      const persistence =
        readyPersistence(
          value,
        );

      persistence.progress.clear();

      await expect(
        finalizeBusinessDeletionExecution(
          {
            persistence,
          },
          {
            manifest:
              value,
          },
        ),
      ).rejects.toThrow(
        "every planned step requires persisted completion progress",
      );

      expect(
        persistence.finalizations,
      ).toHaveLength(0);
    });

    it("fails closed if a completed operation is missing terminal evidence", async () => {
      const value =
        manifest();

      const persistence =
        readyPersistence(
          value,
        );

      const partial =
        persistence.operation;

      persistence.operation =
        transitionBusinessDeletionControlOperation(
          partial,
          {
            expectedStateVersion:
              partial.stateVersion,
            targetState:
              "completed",
            legalHoldSnapshot:
              value.legalHoldSnapshot,
            completedComponentCount:
              value.expectedComponentCount,
            updatedAt:
              COMPLETED_AT,
          },
        );

      await expect(
        finalizeBusinessDeletionExecution(
          {
            persistence,
          },
          {
            manifest:
              value,
          },
        ),
      ).rejects.toThrow(
        "completed operation is missing terminal evidence",
      );
    });

    it("refuses finalization while the supplied manifest is under active legal hold", async () => {
      const value =
        manifest({
          legalHoldStatus:
            "active",
        });

      const persistence =
        new MemoryPersistence(
          createBusinessDeletionControlOperation(
            value,
            CREATED_AT,
          ),
        );

      await expect(
        finalizeBusinessDeletionExecution(
          {
            persistence,
          },
          {
            manifest:
              value,
          },
        ),
      ).rejects.toThrow(
        "active legal hold blocks finalization",
      );

      expect(
        persistence.finalizations,
      ).toHaveLength(0);
    });

    it("keeps finalization free of handler, API, queue, worker, environment, and AWS SDK wiring", async () => {
      const {
        readFile,
      } =
        await import(
          "node:fs/promises"
        );

      const source =
        await readFile(
          new URL(
            "../src/business-deletion-finalization.ts",
            import.meta.url,
          ),
          "utf8",
        );

      for (
        const forbidden of
        [
          "@aws-sdk",
          "DynamoDBClient",
          "DeleteItemCommand",
          "process.env",
          "business-runtime",
          "./handler",
          "APIGateway",
          "SQS",
          "ScanCommand",
          "QueryCommand",
        ]
      ) {
        expect(
          source,
        ).not.toContain(
          forbidden,
        );
      }
    });
  },
);
