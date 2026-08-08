import { createHash } from "node:crypto";

import {
  type BusinessDeletionExecutionPlan,
  type BusinessDeletionExecutionStep,
  type BusinessDeletionManifest,
  createBusinessDeletionExecutionProgress,
  planBusinessDeletionExecution,
  recordBusinessDeletionComponentCompletion,
} from "./business-deletion-execution.js";
import {
  type BusinessDeletionControlOperationMutationGuard,
  type BusinessDeletionControlOperationRoot,
  type BusinessDeletionControlProgressMutationGuard,
  type BusinessDeletionControlProgressRecord,
  acquireBusinessDeletionControlLease,
  businessDeletionControlOperationGuard,
  businessDeletionControlProgressGuard,
  createBusinessDeletionControlProgress,
  recordBusinessDeletionControlProgress,
  transitionBusinessDeletionControlOperation,
} from "./business-deletion-control-store.js";

export const BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION =
  1 as const;

export const BUSINESS_DELETION_ORCHESTRATION_BOUNDARY =
  Object.freeze({
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
  } as const);

export interface BusinessDeletionOrchestrationPersistence {
  getOperation(
    operationId:
      string,
  ): Promise<
    BusinessDeletionControlOperationRoot |
    null
  >;

  getProgress(
    operationId:
      string,
    stepIndex:
      number,
  ): Promise<
    BusinessDeletionControlProgressRecord |
    null
  >;

  putProgress(
    record:
      BusinessDeletionControlProgressRecord,
  ): Promise<void>;

  updateOperation(
    guard:
      BusinessDeletionControlOperationMutationGuard,
    next:
      BusinessDeletionControlOperationRoot,
  ): Promise<void>;

  updateProgress(
    guard:
      BusinessDeletionControlProgressMutationGuard,
    next:
      BusinessDeletionControlProgressRecord,
  ): Promise<void>;
}

export interface BusinessDeletionExecutionPortInput {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION;
  readonly operationId:
    string;
  readonly manifestIntegrityDigest:
    string;
  readonly stepIndex:
    number;
  readonly step:
    BusinessDeletionExecutionStep;
  readonly attemptTokenDigest:
    string;
  readonly attemptNumber:
    number;
}

export interface BusinessDeletionExecutionPortResult {
  readonly outcome:
    "verified-complete";
  readonly completedComponentIds:
    readonly string[];
  readonly verifiedAt:
    string;
}

export interface BusinessDeletionExecutionPort {
  executeStep(
    input:
      Readonly<
        BusinessDeletionExecutionPortInput
      >,
  ): Promise<
    Readonly<
      BusinessDeletionExecutionPortResult
    >
  >;
}

export interface BusinessDeletionOrchestrationDependencies {
  readonly persistence:
    BusinessDeletionOrchestrationPersistence;
  readonly executionPort:
    BusinessDeletionExecutionPort;
}

export interface BusinessDeletionOrchestrationStepInput {
  readonly manifest:
    BusinessDeletionManifest;
  readonly stepIndex:
    number;
  readonly leaseTokenDigest:
    string;
  readonly leaseAcquiredAt:
    string;
  readonly leaseExpiresAt:
    string;
}

export type BusinessDeletionOrchestrationStepResult =
  Readonly<{
    schemaVersion:
      typeof BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION;
    outcome:
      | "step-completed"
      | "already-recorded";
    operationId:
      string;
    stepIndex:
      number;
    completedComponentCount:
      number;
    expectedComponentCount:
      number;
    finalizationRequired:
      boolean;
  }>;

function orchestrationError(
  message:
    string,
): Error {
  return new Error(
    `Deletion orchestration refused: ${message}`,
  );
}

function canonicalStepIndex(
  value:
    number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw orchestrationError(
      "step index is invalid.",
    );
  }

  return value;
}

function componentIdsForStep(
  step:
    BusinessDeletionExecutionStep,
): readonly string[] {
  return step.componentIds;
}

function exactStringSet(
  expected:
    readonly string[],
  actual:
    readonly string[],
): boolean {
  if (
    actual.length !==
    expected.length
  ) {
    return false;
  }

  const expectedSet =
    new Set(expected);

  if (
    expectedSet.size !==
    expected.length
  ) {
    throw orchestrationError(
      "planned step contains duplicate component identifiers.",
    );
  }

  const actualSet =
    new Set(actual);

  if (
    actualSet.size !==
    actual.length
  ) {
    return false;
  }

  for (
    const value of
    expectedSet
  ) {
    if (
      !actualSet.has(value)
    ) {
      return false;
    }
  }

  return true;
}

export function businessDeletionStepComponentRangeDigest(
  step:
    BusinessDeletionExecutionStep,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION,
        step.kind,
        step.stepId,
        step.requiredLegalHoldVersion,
        ...step.componentIds,
      ]),
      "utf8",
    )
    .digest("hex");
}

function assertPlanExecutable(
  plan:
    BusinessDeletionExecutionPlan,
): asserts plan is Exclude<
  BusinessDeletionExecutionPlan,
  Readonly<{
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
> {
  if (
    plan.mode ===
    "blocked-legal-hold"
  ) {
    throw orchestrationError(
      "active legal hold blocks execution.",
    );
  }
}

function assertOperationBinding(
  operation:
    BusinessDeletionControlOperationRoot,
  manifest:
    BusinessDeletionManifest,
): void {
  if (
    operation.operationId !==
      manifest.operationId ||
    operation.manifestIntegrityDigest !==
      manifest.manifestIntegrityDigest ||
    operation.policyVersion !==
      manifest.policyVersion ||
    operation.topologyVersion !==
      manifest.topologyVersion ||
    operation.expectedComponentCount !==
      manifest.expectedComponentCount ||
    operation.legalHoldStatus !==
      manifest.legalHoldSnapshot.status ||
    operation.legalHoldVersion !==
      manifest.legalHoldSnapshot.version
  ) {
    throw orchestrationError(
      "operation does not match the supplied manifest.",
    );
  }
}

function assertProgressBinding(
  progress:
    BusinessDeletionControlProgressRecord,
  manifest:
    BusinessDeletionManifest,
  step:
    BusinessDeletionExecutionStep,
  stepIndex:
    number,
): void {
  if (
    progress.operationId !==
      manifest.operationId ||
    progress.manifestIntegrityDigest !==
      manifest.manifestIntegrityDigest ||
    progress.stepIndex !==
      stepIndex ||
    progress.componentRangeDigest !==
      businessDeletionStepComponentRangeDigest(
        step,
      ) ||
    progress.expectedComponentCount !==
      componentIdsForStep(step).length
  ) {
    throw orchestrationError(
      "persisted step progress does not match the execution plan.",
    );
  }
}

async function completedPredecessorIds(
  persistence:
    BusinessDeletionOrchestrationPersistence,
  manifest:
    BusinessDeletionManifest,
  plan:
    Exclude<
      BusinessDeletionExecutionPlan,
      Readonly<{
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
    >,
  stepIndex:
    number,
): Promise<readonly string[]> {
  const completed =
    new Array<string>();

  for (
    let predecessorIndex = 1;
    predecessorIndex < stepIndex;
    predecessorIndex += 1
  ) {
    const predecessorStep =
      plan.steps[
        predecessorIndex - 1
      ];

    if (!predecessorStep) {
      throw orchestrationError(
        "execution plan predecessor step is missing.",
      );
    }

    const progress =
      await persistence.getProgress(
        manifest.operationId,
        predecessorIndex,
      );

    if (!progress) {
      throw orchestrationError(
        "a predecessor step has no persisted progress.",
      );
    }

    assertProgressBinding(
      progress,
      manifest,
      predecessorStep,
      predecessorIndex,
    );

    if (
      progress.state !==
        "completed" ||
      progress.completedComponentCount !==
        predecessorStep.componentIds.length
    ) {
      throw orchestrationError(
        "steps must complete strictly in plan order.",
      );
    }

    completed.push(
      ...predecessorStep.componentIds,
    );
  }

  return Object.freeze([
    ...completed,
  ]);
}

function result(
  outcome:
    BusinessDeletionOrchestrationStepResult["outcome"],
  manifest:
    BusinessDeletionManifest,
  stepIndex:
    number,
  completedComponentCount:
    number,
): BusinessDeletionOrchestrationStepResult {
  return Object.freeze({
    schemaVersion:
      BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION,
    outcome,
    operationId:
      manifest.operationId,
    stepIndex,
    completedComponentCount,
    expectedComponentCount:
      manifest.expectedComponentCount,
    finalizationRequired:
      completedComponentCount ===
      manifest.expectedComponentCount,
  });
}

async function persistPartialOperation(
  persistence:
    BusinessDeletionOrchestrationPersistence,
  operation:
    BusinessDeletionControlOperationRoot,
  manifest:
    BusinessDeletionManifest,
  completedComponentCount:
    number,
  updatedAt:
    string,
): Promise<
  BusinessDeletionControlOperationRoot
> {
  if (
    operation.state !==
    "executing"
  ) {
    throw orchestrationError(
      "completed step reconciliation requires an executing operation.",
    );
  }

  const guard =
    businessDeletionControlOperationGuard(
      operation,
    );

  const next =
    transitionBusinessDeletionControlOperation(
      operation,
      {
        expectedStateVersion:
          operation.stateVersion,
        targetState:
          "partially-complete",
        legalHoldSnapshot:
          manifest.legalHoldSnapshot,
        completedComponentCount,
        updatedAt,
      },
    );

  await persistence.updateOperation(
    guard,
    next,
  );

  return next;
}

export async function runBusinessDeletionOrchestrationStep(
  dependencies:
    BusinessDeletionOrchestrationDependencies,
  input:
    BusinessDeletionOrchestrationStepInput,
): Promise<
  BusinessDeletionOrchestrationStepResult
> {
  const stepIndex =
    canonicalStepIndex(
      input.stepIndex,
    );

  const plan =
    planBusinessDeletionExecution(
      input.manifest,
    );

  assertPlanExecutable(plan);

  if (
    stepIndex >
    plan.steps.length
  ) {
    throw orchestrationError(
      "step index exceeds the execution plan.",
    );
  }

  const step =
    plan.steps[
      stepIndex - 1
    ];

  if (!step) {
    throw orchestrationError(
      "execution plan step is missing.",
    );
  }

  if (
    step.requiredLegalHoldVersion !==
    input.manifest
      .legalHoldSnapshot
      .version
  ) {
    throw orchestrationError(
      "step legal-hold version does not match the manifest.",
    );
  }

  const operation =
    await dependencies.persistence
      .getOperation(
        input.manifest.operationId,
      );

  if (!operation) {
    throw orchestrationError(
      "operation root does not exist.",
    );
  }

  assertOperationBinding(
    operation,
    input.manifest,
  );

  const predecessorIds =
    await completedPredecessorIds(
      dependencies.persistence,
      input.manifest,
      plan,
      stepIndex,
    );

  const completedBefore =
    predecessorIds.length;

  let progress =
    await dependencies.persistence
      .getProgress(
        input.manifest.operationId,
        stepIndex,
      );

  if (progress) {
    assertProgressBinding(
      progress,
      input.manifest,
      step,
      stepIndex,
    );

    if (
      progress.state ===
      "completed"
    ) {
      const completedThroughStep =
        completedBefore +
        step.componentIds.length;

      if (
        progress.completedComponentCount !==
        step.componentIds.length
      ) {
        throw orchestrationError(
          "completed step progress has an invalid component count.",
        );
      }

      if (
        operation.state ===
          "partially-complete" &&
        operation.completedComponentCount ===
          completedThroughStep
      ) {
        return result(
          "already-recorded",
          input.manifest,
          stepIndex,
          completedThroughStep,
        );
      }

      if (
        operation.state !==
          "executing" ||
        operation.completedComponentCount !==
          completedBefore ||
        !progress.completedAt
      ) {
        throw orchestrationError(
          "completed step and operation state cannot be reconciled safely.",
        );
      }

      await persistPartialOperation(
        dependencies.persistence,
        operation,
        input.manifest,
        completedThroughStep,
        progress.completedAt,
      );

      return result(
        "already-recorded",
        input.manifest,
        stepIndex,
        completedThroughStep,
      );
    }
  }

  if (
    operation.completedComponentCount !==
    completedBefore
  ) {
    throw orchestrationError(
      "operation progress does not match completed predecessor steps.",
    );
  }

  let executingOperation =
    operation;

  if (
    operation.state ===
      "ready" ||
    operation.state ===
      "partially-complete"
  ) {
    const guard =
      businessDeletionControlOperationGuard(
        operation,
      );

    executingOperation =
      transitionBusinessDeletionControlOperation(
        operation,
        {
          expectedStateVersion:
            operation.stateVersion,
          targetState:
            "executing",
          legalHoldSnapshot:
            input.manifest
              .legalHoldSnapshot,
          completedComponentCount:
            completedBefore,
          updatedAt:
            input.leaseAcquiredAt,
        },
      );

    await dependencies.persistence
      .updateOperation(
        guard,
        executingOperation,
      );
  }
  else if (
    operation.state !==
    "executing"
  ) {
    throw orchestrationError(
      "operation is not in an executable state.",
    );
  }

  if (!progress) {
    progress =
      createBusinessDeletionControlProgress(
        executingOperation,
        stepIndex,
        businessDeletionStepComponentRangeDigest(
          step,
        ),
        step.componentIds.length,
        input.leaseAcquiredAt,
      );

    await dependencies.persistence
      .putProgress(
        progress,
      );
  }

  assertProgressBinding(
    progress,
    input.manifest,
    step,
    stepIndex,
  );

  if (
    progress.state ===
    "completed"
  ) {
    throw orchestrationError(
      "completed progress reached an unexpected execution path.",
    );
  }

  const leaseGuard =
    businessDeletionControlProgressGuard(
      progress,
    );

  const leasedProgress =
    acquireBusinessDeletionControlLease(
      progress,
      progress.stateVersion,
      input.leaseTokenDigest,
      input.leaseAcquiredAt,
      input.leaseExpiresAt,
    );

  await dependencies.persistence
    .updateProgress(
      leaseGuard,
      leasedProgress,
    );

  const portResult =
    await dependencies.executionPort
      .executeStep(
        Object.freeze({
          schemaVersion:
            BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION,
          operationId:
            input.manifest.operationId,
          manifestIntegrityDigest:
            input.manifest
              .manifestIntegrityDigest,
          stepIndex,
          step,
          attemptTokenDigest:
            leasedProgress
              .lease!
              .tokenDigest,
          attemptNumber:
            leasedProgress
              .attemptCount,
        }),
      );

  if (
    portResult.outcome !==
      "verified-complete" ||
    !exactStringSet(
      step.componentIds,
      portResult.completedComponentIds,
    )
  ) {
    throw orchestrationError(
      "execution port did not verify the complete planned step.",
    );
  }

  const executionProgress =
    recordBusinessDeletionComponentCompletion(
      input.manifest,
      createBusinessDeletionExecutionProgress(
        input.manifest,
        input.leaseAcquiredAt,
      ),
      [
        ...predecessorIds,
        ...portResult.completedComponentIds,
      ],
      portResult.verifiedAt,
    );

  const completedThroughStep =
    executionProgress
      .completedComponentIds
      .length;

  const progressGuard =
    businessDeletionControlProgressGuard(
      leasedProgress,
    );

  const completedProgress =
    recordBusinessDeletionControlProgress(
      leasedProgress,
      leasedProgress.stateVersion,
      input.leaseTokenDigest,
      step.componentIds.length,
      portResult.verifiedAt,
    );

  await dependencies.persistence
    .updateProgress(
      progressGuard,
      completedProgress,
    );

  await persistPartialOperation(
    dependencies.persistence,
    executingOperation,
    input.manifest,
    completedThroughStep,
    portResult.verifiedAt,
  );

  return result(
    "step-completed",
    input.manifest,
    stepIndex,
    completedThroughStep,
  );
}
