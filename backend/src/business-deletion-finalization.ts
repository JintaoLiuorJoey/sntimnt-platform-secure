import {
  type BusinessDeletionExecutionPlan,
  type BusinessDeletionExecutionStep,
  type BusinessDeletionManifest,
  createBusinessDeletionCompletionEvidence,
  createBusinessDeletionExecutionProgress,
  planBusinessDeletionExecution,
  recordBusinessDeletionComponentCompletion,
} from "./business-deletion-execution.js";
import {
  type BusinessDeletionControlOperationMutationGuard,
  type BusinessDeletionControlOperationRoot,
  type BusinessDeletionControlProgressRecord,
  type BusinessDeletionControlTerminalEvidenceRecord,
  businessDeletionControlOperationGuard,
  createBusinessDeletionControlTerminalEvidence,
  transitionBusinessDeletionControlOperation,
} from "./business-deletion-control-store.js";
import {
  businessDeletionStepComponentRangeDigest,
} from "./business-deletion-orchestration.js";

export const BUSINESS_DELETION_FINALIZATION_SCHEMA_VERSION =
  1 as const;

export const BUSINESS_DELETION_FINALIZATION_BOUNDARY =
  Object.freeze({
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
  } as const);

export interface BusinessDeletionFinalizationPersistence {
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

  getTerminalEvidence(
    operationId:
      string,
  ): Promise<
    BusinessDeletionControlTerminalEvidenceRecord |
    null
  >;

  finalizeOperationAndTerminalEvidence(
    guard:
      BusinessDeletionControlOperationMutationGuard,
    next:
      BusinessDeletionControlOperationRoot,
    evidence:
      BusinessDeletionControlTerminalEvidenceRecord,
  ): Promise<void>;
}

export interface BusinessDeletionFinalizationDependencies {
  readonly persistence:
    BusinessDeletionFinalizationPersistence;
}

export interface BusinessDeletionFinalizationInput {
  readonly manifest:
    BusinessDeletionManifest;
}

export type BusinessDeletionFinalizationResult =
  Readonly<{
    schemaVersion:
      typeof BUSINESS_DELETION_FINALIZATION_SCHEMA_VERSION;
    outcome:
      | "finalized"
      | "already-finalized";
    operationId:
      string;
    completedComponentCount:
      number;
    expectedComponentCount:
      number;
    completedAt:
      string;
  }>;

function finalizationError(
  message:
    string,
): Error {
  return new Error(
    `Deletion finalization refused: ${message}`,
  );
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
    throw finalizationError(
      "active legal hold blocks finalization.",
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
    throw finalizationError(
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
      step.componentIds.length
  ) {
    throw finalizationError(
      "persisted progress does not match the execution plan.",
    );
  }
}

function sameCompletedOperation(
  actual:
    BusinessDeletionControlOperationRoot,
  expected:
    BusinessDeletionControlOperationRoot,
): boolean {
  return (
    actual.pk === expected.pk &&
    actual.sk === expected.sk &&
    actual.schemaVersion === expected.schemaVersion &&
    actual.keyVersion === expected.keyVersion &&
    actual.kind === expected.kind &&
    actual.operationId === expected.operationId &&
    actual.manifestIntegrityDigest === expected.manifestIntegrityDigest &&
    actual.policyVersion === expected.policyVersion &&
    actual.topologyVersion === expected.topologyVersion &&
    actual.expectedComponentCount === expected.expectedComponentCount &&
    actual.state === expected.state &&
    actual.stateVersion === expected.stateVersion &&
    actual.legalHoldStatus === expected.legalHoldStatus &&
    actual.legalHoldVersion === expected.legalHoldVersion &&
    actual.completedComponentCount === expected.completedComponentCount &&
    actual.createdAt === expected.createdAt &&
    actual.updatedAt === expected.updatedAt &&
    actual.terminalAt === expected.terminalAt &&
    actual.retireAfter === expected.retireAfter
  );
}

function sameTerminalEvidence(
  actual:
    BusinessDeletionControlTerminalEvidenceRecord,
  expected:
    BusinessDeletionControlTerminalEvidenceRecord,
): boolean {
  return (
    actual.pk === expected.pk &&
    actual.sk === expected.sk &&
    actual.schemaVersion === expected.schemaVersion &&
    actual.keyVersion === expected.keyVersion &&
    actual.kind === expected.kind &&
    actual.operationId === expected.operationId &&
    actual.policyVersion === expected.policyVersion &&
    actual.topologyVersion === expected.topologyVersion &&
    actual.manifestIntegrityDigest === expected.manifestIntegrityDigest &&
    actual.expectedComponentCount === expected.expectedComponentCount &&
    actual.deletedComponentCount === expected.deletedComponentCount &&
    actual.completedAt === expected.completedAt &&
    actual.outcome === expected.outcome &&
    actual.backupDisclosureVersion === expected.backupDisclosureVersion &&
    actual.backupDisclosure === expected.backupDisclosure &&
    actual.retentionMode === expected.retentionMode
  );
}

async function completedExecutionProgress(
  persistence:
    BusinessDeletionFinalizationPersistence,
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
) {
  let executionProgress =
    createBusinessDeletionExecutionProgress(
      manifest,
      manifest.createdAt,
    );

  for (
    let stepOffset = 0;
    stepOffset < plan.steps.length;
    stepOffset += 1
  ) {
    const step =
      plan.steps[stepOffset];

    if (!step) {
      throw finalizationError(
        "execution plan step is missing.",
      );
    }

    const stepIndex =
      stepOffset + 1;

    const progress =
      await persistence.getProgress(
        manifest.operationId,
        stepIndex,
      );

    if (!progress) {
      throw finalizationError(
        "every planned step requires persisted completion progress.",
      );
    }

    assertProgressBinding(
      progress,
      manifest,
      step,
      stepIndex,
    );

    if (
      progress.state !==
        "completed" ||
      progress.completedComponentCount !==
        step.componentIds.length ||
      !progress.completedAt
    ) {
      throw finalizationError(
        "every planned step must be fully completed before finalization.",
      );
    }

    executionProgress =
      recordBusinessDeletionComponentCompletion(
        manifest,
        executionProgress,
        step.componentIds,
        progress.completedAt,
      );
  }

  return executionProgress;
}

function finalizationResult(
  outcome:
    BusinessDeletionFinalizationResult["outcome"],
  operation:
    BusinessDeletionControlOperationRoot,
): BusinessDeletionFinalizationResult {
  if (
    operation.state !==
      "completed" ||
    !operation.terminalAt
  ) {
    throw finalizationError(
      "result requires a completed operation.",
    );
  }

  return Object.freeze({
    schemaVersion:
      BUSINESS_DELETION_FINALIZATION_SCHEMA_VERSION,
    outcome,
    operationId:
      operation.operationId,
    completedComponentCount:
      operation.completedComponentCount,
    expectedComponentCount:
      operation.expectedComponentCount,
    completedAt:
      operation.terminalAt,
  });
}

export async function finalizeBusinessDeletionExecution(
  dependencies:
    BusinessDeletionFinalizationDependencies,
  input:
    BusinessDeletionFinalizationInput,
): Promise<
  BusinessDeletionFinalizationResult
> {
  const plan =
    planBusinessDeletionExecution(
      input.manifest,
    );

  assertPlanExecutable(plan);

  const executionProgress =
    await completedExecutionProgress(
      dependencies.persistence,
      input.manifest,
      plan,
    );

  const completionEvidence =
    createBusinessDeletionCompletionEvidence(
      input.manifest,
      executionProgress,
    );

  const currentOperation =
    await dependencies.persistence.getOperation(
      input.manifest.operationId,
    );

  if (!currentOperation) {
    throw finalizationError(
      "operation does not exist.",
    );
  }

  assertOperationBinding(
    currentOperation,
    input.manifest,
  );

  const persistedEvidence =
    await dependencies.persistence.getTerminalEvidence(
      input.manifest.operationId,
    );

  if (
    currentOperation.state ===
    "completed"
  ) {
    if (!persistedEvidence) {
      throw finalizationError(
        "completed operation is missing terminal evidence.",
      );
    }

    const expectedEvidence =
      createBusinessDeletionControlTerminalEvidence(
        currentOperation,
        completionEvidence,
      );

    if (
      !sameTerminalEvidence(
        persistedEvidence,
        expectedEvidence,
      )
    ) {
      throw finalizationError(
        "persisted terminal evidence does not match completed operation evidence.",
      );
    }

    return finalizationResult(
      "already-finalized",
      currentOperation,
    );
  }

  if (persistedEvidence) {
    throw finalizationError(
      "terminal evidence exists before operation completion.",
    );
  }

  if (
    currentOperation.state !==
      "partially-complete" ||
    currentOperation.completedComponentCount !==
      input.manifest.expectedComponentCount
  ) {
    throw finalizationError(
      "operation is not ready for terminal completion.",
    );
  }

  const guard =
    businessDeletionControlOperationGuard(
      currentOperation,
    );

  const completedOperation =
    transitionBusinessDeletionControlOperation(
      currentOperation,
      {
        expectedStateVersion:
          currentOperation.stateVersion,
        targetState:
          "completed",
        legalHoldSnapshot:
          input.manifest.legalHoldSnapshot,
        completedComponentCount:
          input.manifest.expectedComponentCount,
        updatedAt:
          completionEvidence.completedAt,
      },
    );

  const terminalEvidence =
    createBusinessDeletionControlTerminalEvidence(
      completedOperation,
      completionEvidence,
    );

  try {
    await dependencies.persistence
      .finalizeOperationAndTerminalEvidence(
        guard,
        completedOperation,
        terminalEvidence,
      );
  }
  catch (error) {
    let reconciledOperation:
      BusinessDeletionControlOperationRoot |
      null;
    let reconciledEvidence:
      BusinessDeletionControlTerminalEvidenceRecord |
      null;

    try {
      reconciledOperation =
        await dependencies.persistence.getOperation(
          input.manifest.operationId,
        );

      reconciledEvidence =
        await dependencies.persistence.getTerminalEvidence(
          input.manifest.operationId,
        );
    }
    catch {
      throw error;
    }

    if (
      reconciledOperation &&
      reconciledEvidence &&
      sameCompletedOperation(
        reconciledOperation,
        completedOperation,
      ) &&
      sameTerminalEvidence(
        reconciledEvidence,
        terminalEvidence,
      )
    ) {
      return finalizationResult(
        "already-finalized",
        reconciledOperation,
      );
    }

    if (
      reconciledOperation &&
      sameCompletedOperation(
        reconciledOperation,
        currentOperation,
      ) &&
      !reconciledEvidence
    ) {
      throw error;
    }

    throw finalizationError(
      "failed finalization could not be reconciled to one exact terminal state.",
    );
  }

  return finalizationResult(
    "finalized",
    completedOperation,
  );
}
