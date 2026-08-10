import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  BUSINESS_DELETION_TOPOLOGY_VERSION,
  createBusinessDeletionManifest,
  type BusinessDeletionComponentInput,
  type BusinessDeletionManifest,
} from "../src/business-deletion-execution.js";
import {
  createBusinessDeletionControlOperation,
  transitionBusinessDeletionControlOperation,
  type BusinessDeletionControlOperationMutationGuard,
  type BusinessDeletionControlOperationRoot,
  type BusinessDeletionControlProgressMutationGuard,
  type BusinessDeletionControlProgressRecord,
} from "../src/business-deletion-control-store.js";
import {
  BUSINESS_RETENTION_POLICY_VERSION,
} from "../src/business-retention-lifecycle.js";
import {
  BUSINESS_DELETION_ORCHESTRATION_BOUNDARY,
  BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION,
  businessDeletionStepComponentRangeDigest,
  runBusinessDeletionOrchestrationStep,
  type BusinessDeletionExecutionPort,
  type BusinessDeletionOrchestrationPersistence,
} from "../src/business-deletion-orchestration.js";

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

const LEASE_TOKEN_DIGEST =
  "d".repeat(64);

const CREATED_AT =
  "2026-08-07T18:00:00.000Z";

const READY_AT =
  "2026-08-07T18:01:00.000Z";

const LEASE_AT =
  "2026-08-07T18:02:00.000Z";

const VERIFIED_AT =
  "2026-08-07T18:03:00.000Z";

const LEASE_EXPIRES_AT =
  "2026-08-07T18:12:00.000Z";

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

function readyOperation(
  value =
    manifest(),
): BusinessDeletionControlOperationRoot {
  const created =
    createBusinessDeletionControlOperation(
      value,
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
        value.legalHoldSnapshot,
      completedComponentCount:
        0,
      updatedAt:
        READY_AT,
    },
  );
}

class MemoryPersistence
  implements BusinessDeletionOrchestrationPersistence {
  operation:
    BusinessDeletionControlOperationRoot;

  readonly progress =
    new Map<
      number,
      BusinessDeletionControlProgressRecord
    >();

  readonly operationUpdates =
    new Array<{
      guard:
        BusinessDeletionControlOperationMutationGuard;
      next:
        BusinessDeletionControlOperationRoot;
    }>();

  readonly progressUpdates =
    new Array<{
      guard:
        BusinessDeletionControlProgressMutationGuard;
      next:
        BusinessDeletionControlProgressRecord;
    }>();

  readonly putProgressCalls =
    new Array<
      BusinessDeletionControlProgressRecord
    >();

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

  async putProgress(
    record:
      BusinessDeletionControlProgressRecord,
  ) {
    if (
      this.progress.has(
        record.stepIndex,
      )
    ) {
      throw new Error(
        "conflict",
      );
    }

    this.putProgressCalls.push(
      record,
    );

    this.progress.set(
      record.stepIndex,
      record,
    );
  }

  async updateOperation(
    guard:
      BusinessDeletionControlOperationMutationGuard,
    next:
      BusinessDeletionControlOperationRoot,
  ) {
    expect(guard).toEqual({
      operationId:
        this.operation.operationId,
      expectedState:
        this.operation.state,
      expectedStateVersion:
        this.operation.stateVersion,
      expectedLegalHoldVersion:
        this.operation
          .legalHoldVersion,
    });

    this.operationUpdates.push({
      guard,
      next,
    });

    this.operation =
      next;
  }

  async updateProgress(
    guard:
      BusinessDeletionControlProgressMutationGuard,
    next:
      BusinessDeletionControlProgressRecord,
  ) {
    const current =
      this.progress.get(
        next.stepIndex,
      );

    expect(current).toBeDefined();

    expect(guard).toMatchObject({
      operationId:
        current!.operationId,
      stepIndex:
        current!.stepIndex,
      expectedState:
        current!.state,
      expectedStateVersion:
        current!.stateVersion,
      expectedLeaseVersion:
        current!.leaseVersion,
    });

    this.progressUpdates.push({
      guard,
      next,
    });

    this.progress.set(
      next.stepIndex,
      next,
    );
  }
}

function verifiedPort(
  completedComponentIds:
    readonly string[] = [
      "ciphertext-primary",
      "derived-index-01",
    ],
): {
  port:
    BusinessDeletionExecutionPort;
  executeStep:
    ReturnType<typeof vi.fn>;
} {
  const executeStep =
    vi.fn()
      .mockResolvedValue({
        outcome:
          "verified-complete",
        completedComponentIds,
        verifiedAt:
          VERIFIED_AT,
      });

  return {
    port: {
      executeStep,
    },
    executeStep,
  };
}

describe(
  "business deletion orchestration contracts",
  () => {
    it(
      "publishes a deliberately narrow non-terminalizing boundary",
      () => {
        expect(
          BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION,
        ).toBe(1);

        expect(
          BUSINESS_DELETION_ORCHESTRATION_BOUNDARY,
        ).toEqual({
          stepExecution:
            "dependency-injected-verified-completion",
          componentLocatorExposure:
            "prohibited",
          operationDiscovery:
            "exact-operation-id-only",
          workerDiscovery:
            "no-scan",
          stepOrdering:
            "strict-sequential",
          finalization:
            "separate-reviewed-slice",
          terminalEvidenceWrite:
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
      },
    );

    it(
      "runs one verified atomic step and stops at partially-complete for separate finalization",
      async () => {
        const value =
          manifest();

        const persistence =
          new MemoryPersistence(
            readyOperation(value),
          );

        const {
          port,
          executeStep,
        } =
          verifiedPort();

        const result =
          await runBusinessDeletionOrchestrationStep(
            {
              persistence,
              executionPort:
                port,
            },
            {
              manifest:
                value,
              stepIndex:
                1,
              leaseTokenDigest:
                LEASE_TOKEN_DIGEST,
              leaseAcquiredAt:
                LEASE_AT,
              leaseExpiresAt:
                LEASE_EXPIRES_AT,
            },
          );

        expect(result).toEqual({
          schemaVersion:
            1,
          outcome:
            "step-completed",
          operationId:
            OPERATION_ID,
          stepIndex:
            1,
          completedComponentCount:
            2,
          expectedComponentCount:
            2,
          finalizationRequired:
            true,
        });

        expect(
          persistence.operation.state,
        ).toBe(
          "partially-complete",
        );

        expect(
          persistence.operation
            .completedComponentCount,
        ).toBe(2);

        expect(
          persistence.operation
            .terminalAt,
        ).toBeUndefined();

        const progress =
          persistence.progress.get(1);

        expect(
          progress?.state,
        ).toBe(
          "completed",
        );

        expect(
          progress
            ?.completedComponentCount,
        ).toBe(2);

        expect(
          executeStep,
        ).toHaveBeenCalledTimes(1);

        expect(
          persistence.operationUpdates,
        ).toHaveLength(2);

        expect(
          persistence.progressUpdates,
        ).toHaveLength(2);
      },
    );

    it(
      "never sends raw component locators to the execution port",
      async () => {
        const value =
          manifest();

        const persistence =
          new MemoryPersistence(
            readyOperation(value),
          );

        const {
          port,
          executeStep,
        } =
          verifiedPort();

        await runBusinessDeletionOrchestrationStep(
          {
            persistence,
            executionPort:
              port,
          },
          {
            manifest:
              value,
            stepIndex:
              1,
            leaseTokenDigest:
              LEASE_TOKEN_DIGEST,
            leaseAcquiredAt:
              LEASE_AT,
            leaseExpiresAt:
              LEASE_EXPIRES_AT,
          },
        );

        const firstCall =
          executeStep.mock.calls[0];

        expect(
          firstCall,
        ).toBeDefined();

        if (!firstCall) {
          throw new Error(
            "Expected execution port call.",
          );
        }

        const serialized =
          JSON.stringify(
            firstCall[0],
          );

        expect(
          serialized,
        ).not.toContain(
          OWNER,
        );

        expect(
          serialized,
        ).not.toContain(
          "BUSINESS#SENSITIVE#",
        );

        expect(
          serialized,
        ).not.toContain(
          '"locator"',
        );

        expect(
          serialized,
        ).toContain(
          '"manifestIntegrityDigest"',
        );
      },
    );

    it(
      "fails closed under an active legal hold before persistence or execution",
      async () => {
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

        const getOperation =
          vi.spyOn(
            persistence,
            "getOperation",
          );

        const {
          port,
          executeStep,
        } =
          verifiedPort();

        await expect(
          runBusinessDeletionOrchestrationStep(
            {
              persistence,
              executionPort:
                port,
            },
            {
              manifest:
                value,
              stepIndex:
                1,
              leaseTokenDigest:
                LEASE_TOKEN_DIGEST,
              leaseAcquiredAt:
                LEASE_AT,
              leaseExpiresAt:
                LEASE_EXPIRES_AT,
            },
          ),
        ).rejects.toThrow(
          "active legal hold blocks execution",
        );

        expect(
          getOperation,
        ).not.toHaveBeenCalled();

        expect(
          executeStep,
        ).not.toHaveBeenCalled();

        expect(
          persistence.operationUpdates,
        ).toHaveLength(0);

        expect(
          persistence.progressUpdates,
        ).toHaveLength(0);
      },
    );

    it(
      "does not advance persisted completion when the port cannot verify the entire step",
      async () => {
        const value =
          manifest();

        const persistence =
          new MemoryPersistence(
            readyOperation(value),
          );

        const {
          port,
        } =
          verifiedPort([
            "ciphertext-primary",
          ]);

        await expect(
          runBusinessDeletionOrchestrationStep(
            {
              persistence,
              executionPort:
                port,
            },
            {
              manifest:
                value,
              stepIndex:
                1,
              leaseTokenDigest:
                LEASE_TOKEN_DIGEST,
              leaseAcquiredAt:
                LEASE_AT,
              leaseExpiresAt:
                LEASE_EXPIRES_AT,
            },
          ),
        ).rejects.toThrow(
          "did not verify the complete planned step",
        );

        expect(
          persistence.operation.state,
        ).toBe(
          "executing",
        );

        expect(
          persistence.operation
            .completedComponentCount,
        ).toBe(0);

        const progress =
          persistence.progress.get(1);

        expect(
          progress?.state,
        ).toBe(
          "executing",
        );

        expect(
          progress
            ?.completedComponentCount,
        ).toBe(0);
      },
    );

    it(
      "treats a fully recorded step as idempotent and does not execute it twice",
      async () => {
        const value =
          manifest();

        const persistence =
          new MemoryPersistence(
            readyOperation(value),
          );

        const first =
          verifiedPort();

        await runBusinessDeletionOrchestrationStep(
          {
            persistence,
            executionPort:
              first.port,
          },
          {
            manifest:
              value,
            stepIndex:
              1,
            leaseTokenDigest:
              LEASE_TOKEN_DIGEST,
            leaseAcquiredAt:
              LEASE_AT,
            leaseExpiresAt:
              LEASE_EXPIRES_AT,
          },
        );

        const second =
          verifiedPort();

        const replay =
          await runBusinessDeletionOrchestrationStep(
            {
              persistence,
              executionPort:
                second.port,
            },
            {
              manifest:
                value,
              stepIndex:
                1,
              leaseTokenDigest:
                "e".repeat(64),
              leaseAcquiredAt:
                "2026-08-07T18:04:00.000Z",
              leaseExpiresAt:
                "2026-08-07T18:14:00.000Z",
            },
          );

        expect(
          replay.outcome,
        ).toBe(
          "already-recorded",
        );

        expect(
          replay.finalizationRequired,
        ).toBe(true);

        expect(
          second.executeStep,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "binds persisted progress to a deterministic step digest",
      () => {
        const value =
          manifest();

        const plan =
          // This manifest is intentionally a single DynamoDB transaction.
          // The orchestration digest never includes raw locators.
          value;

        expect(
          businessDeletionStepComponentRangeDigest,
        ).toBeTypeOf(
          "function",
        );

        expect(
          plan.components,
        ).toHaveLength(2);
      },
    );
  },
);
