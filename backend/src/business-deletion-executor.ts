import {
  BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS,
  type BusinessDeletionComponent,
  type BusinessDeletionDynamoDbLocator,
  type BusinessDeletionExecutionStep,
  type BusinessDeletionExternalLocator,
  type BusinessDeletionExternalSystemRole,
  type BusinessDeletionManifest,
} from "./business-deletion-execution.js";
import {
  BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION,
  type BusinessDeletionExecutionPort,
  type BusinessDeletionExecutionPortInput,
  type BusinessDeletionExecutionPortResult,
} from "./business-deletion-orchestration.js";

export const BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION =
  1 as const;

export const BUSINESS_DELETION_EXECUTOR_BOUNDARY =
  Object.freeze({
    manifestBinding:
      "construction-time-exact-manifest",
    manifestIntegrityBinding:
      "exact-digest",
    operationBinding:
      "exact-operation-id",
    orchestrationInput:
      "sanitized-step-only",
    rawLocatorResolution:
      "executor-boundary-only",
    dynamoDbAdapter:
      "dependency-injected-contract-only",
    externalAdapter:
      "dependency-injected-contract-only",
    adapterCompletion:
      "verified-complete-exact-component-set",
    persistence:
      false,
    logging:
      false,
    awsSdk:
      false,
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

export interface BusinessDeletionDynamoDbTarget {
  readonly componentId:
    string;
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
}

export interface BusinessDeletionExternalTarget {
  readonly componentId:
    string;
  readonly systemRole:
    BusinessDeletionExternalSystemRole;
  readonly referenceDigest:
    string;
}

export interface BusinessDeletionDynamoDbAdapterInput {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION;
  readonly operationId:
    string;
  readonly manifestIntegrityDigest:
    string;
  readonly stepIndex:
    number;
  readonly stepId:
    string;
  readonly attemptTokenDigest:
    string;
  readonly attemptNumber:
    number;
  readonly requiredLegalHoldVersion:
    number;
  readonly targets:
    readonly BusinessDeletionDynamoDbTarget[];
}

export interface BusinessDeletionExternalAdapterInput {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION;
  readonly operationId:
    string;
  readonly manifestIntegrityDigest:
    string;
  readonly stepIndex:
    number;
  readonly stepId:
    string;
  readonly attemptTokenDigest:
    string;
  readonly attemptNumber:
    number;
  readonly requiredLegalHoldVersion:
    number;
  readonly target:
    BusinessDeletionExternalTarget;
}

export interface BusinessDeletionAdapterVerifiedCompletion {
  readonly outcome:
    "verified-complete";
  readonly completedComponentIds:
    readonly string[];
  readonly verifiedAt:
    string;
}

export interface BusinessDeletionDynamoDbAdapter {
  execute(
    input:
      Readonly<
        BusinessDeletionDynamoDbAdapterInput
      >,
  ): Promise<
    Readonly<
      BusinessDeletionAdapterVerifiedCompletion
    >
  >;
}

export interface BusinessDeletionExternalAdapter {
  execute(
    input:
      Readonly<
        BusinessDeletionExternalAdapterInput
      >,
  ): Promise<
    Readonly<
      BusinessDeletionAdapterVerifiedCompletion
    >
  >;
}

export interface ManifestBoundBusinessDeletionExecutorDependencies {
  readonly dynamoDbAdapter:
    BusinessDeletionDynamoDbAdapter;
  readonly externalAdapter:
    BusinessDeletionExternalAdapter;
}

function executorError(
  message:
    string,
): Error {
  return new Error(
    `Deletion executor refused: ${message}`,
  );
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
    throw executorError(
      "requested component identifiers contain duplicates.",
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
      !actualSet.has(
        value,
      )
    ) {
      return false;
    }
  }

  return true;
}

function canonicalVerifiedAt(
  value:
    string,
): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0
  ) {
    throw executorError(
      "adapter verification time is invalid.",
    );
  }

  const milliseconds =
    Date.parse(value);

  if (
    !Number.isFinite(
      milliseconds,
    ) ||
    new Date(
      milliseconds,
    ).toISOString() !==
      value
  ) {
    throw executorError(
      "adapter verification time is invalid.",
    );
  }

  return value;
}

function componentMap(
  manifest:
    BusinessDeletionManifest,
): ReadonlyMap<
  string,
  BusinessDeletionComponent
> {
  if (
    !Array.isArray(
      manifest.components,
    ) ||
    manifest.components.length !==
      manifest.expectedComponentCount ||
    manifest.components.length < 1
  ) {
    throw executorError(
      "bound manifest component count is invalid.",
    );
  }

  const byId =
    new Map<
      string,
      BusinessDeletionComponent
    >();

  for (
    const component of
    manifest.components
  ) {
    if (
      byId.has(
        component.componentId,
      )
    ) {
      throw executorError(
        "bound manifest contains duplicate component identifiers.",
      );
    }

    byId.set(
      component.componentId,
      component,
    );
  }

  return byId;
}

function requestedComponents(
  byId:
    ReadonlyMap<
      string,
      BusinessDeletionComponent
    >,
  step:
    BusinessDeletionExecutionStep,
): readonly BusinessDeletionComponent[] {
  const componentIds =
    step.componentIds;

  if (
    !Array.isArray(
      componentIds,
    ) ||
    componentIds.length < 1
  ) {
    throw executorError(
      "requested component identifiers are invalid.",
    );
  }

  if (
    new Set(
      componentIds,
    ).size !==
    componentIds.length
  ) {
    throw executorError(
      "requested component identifiers contain duplicates.",
    );
  }

  return Object.freeze(
    componentIds.map(
      (
        componentId,
      ) => {
        const component =
          byId.get(
            componentId,
          );

        if (!component) {
          throw executorError(
            "requested component is not present in the bound manifest.",
          );
        }

        return component;
      },
    ),
  );
}

function dynamoTarget(
  component:
    BusinessDeletionComponent,
  expectedAccountId:
    string,
  expectedRegion:
    string,
): BusinessDeletionDynamoDbTarget {
  if (
    component.locator.system !==
    "dynamodb"
  ) {
    throw executorError(
      "DynamoDB step contains a non-DynamoDB component.",
    );
  }

  const locator:
    BusinessDeletionDynamoDbLocator =
      component.locator;

  if (
    locator.tableRole !==
      "business-table"
  ) {
    throw executorError(
      "DynamoDB target table role is invalid.",
    );
  }

  if (
    locator.awsAccountId !==
      expectedAccountId
  ) {
    throw executorError(
      "DynamoDB target AWS account does not match the planned step.",
    );
  }

  if (
    locator.awsRegion !==
      expectedRegion
  ) {
    throw executorError(
      "DynamoDB target AWS Region does not match the planned step.",
    );
  }

  return Object.freeze({
    componentId:
      component.componentId,
    tableRole:
      locator.tableRole,
    awsAccountId:
      locator.awsAccountId,
    awsRegion:
      locator.awsRegion,
    partitionKey:
      locator.partitionKey,
    sortKey:
      locator.sortKey,
  });
}

function externalTarget(
  component:
    BusinessDeletionComponent,
  expectedSystemRole:
    BusinessDeletionExternalSystemRole,
): BusinessDeletionExternalTarget {
  if (
    component.locator.system !==
    "external-copy"
  ) {
    throw executorError(
      "external step contains a non-external component.",
    );
  }

  const locator:
    BusinessDeletionExternalLocator =
      component.locator;

  if (
    locator.systemRole !==
      expectedSystemRole
  ) {
    throw executorError(
      "external target system role does not match the planned step.",
    );
  }

  return Object.freeze({
    componentId:
      component.componentId,
    systemRole:
      locator.systemRole,
    referenceDigest:
      locator.referenceDigest,
  });
}

function assertBoundInput(
  manifest:
    BusinessDeletionManifest,
  input:
    Readonly<
      BusinessDeletionExecutionPortInput
    >,
): void {
  if (
    input.schemaVersion !==
      BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION
  ) {
    throw executorError(
      "orchestration schema version is invalid.",
    );
  }

  if (
    input.operationId !==
      manifest.operationId
  ) {
    throw executorError(
      "operation does not match the bound manifest.",
    );
  }

  if (
    input.manifestIntegrityDigest !==
      manifest.manifestIntegrityDigest
  ) {
    throw executorError(
      "manifest digest does not match the bound manifest.",
    );
  }

  if (
    !Number.isSafeInteger(
      input.stepIndex,
    ) ||
    input.stepIndex < 1
  ) {
    throw executorError(
      "step index is invalid.",
    );
  }

  if (
    !Number.isSafeInteger(
      input.attemptNumber,
    ) ||
    input.attemptNumber < 1
  ) {
    throw executorError(
      "attempt number is invalid.",
    );
  }

  if (
    manifest.legalHoldSnapshot.status !==
      "inactive"
  ) {
    throw executorError(
      "bound manifest is blocked by an active legal hold.",
    );
  }

  if (
    input.step.requiredLegalHoldVersion !==
      manifest.legalHoldSnapshot.version
  ) {
    throw executorError(
      "step legal-hold version does not match the bound manifest.",
    );
  }
}

function verifiedResult(
  expectedComponentIds:
    readonly string[],
  result:
    Readonly<
      BusinessDeletionAdapterVerifiedCompletion
    >,
): Readonly<
  BusinessDeletionExecutionPortResult
> {
  if (
    !result ||
    result.outcome !==
      "verified-complete" ||
    !Array.isArray(
      result.completedComponentIds,
    ) ||
    !exactStringSet(
      expectedComponentIds,
      result.completedComponentIds,
    )
  ) {
    throw executorError(
      "adapter did not verify the exact planned component set.",
    );
  }

  return Object.freeze({
    outcome:
      "verified-complete",
    completedComponentIds:
      Object.freeze([
        ...expectedComponentIds,
      ]),
    verifiedAt:
      canonicalVerifiedAt(
        result.verifiedAt,
      ),
  });
}

export function createManifestBoundBusinessDeletionExecutionPort(
  manifest:
    BusinessDeletionManifest,
  dependencies:
    ManifestBoundBusinessDeletionExecutorDependencies,
): BusinessDeletionExecutionPort {
  if (
    !manifest ||
    typeof manifest.operationId !==
      "string" ||
    typeof manifest.manifestIntegrityDigest !==
      "string"
  ) {
    throw executorError(
      "a valid deletion manifest is required.",
    );
  }

  if (
    !dependencies ||
    !dependencies.dynamoDbAdapter ||
    typeof dependencies.dynamoDbAdapter.execute !==
      "function" ||
    !dependencies.externalAdapter ||
    typeof dependencies.externalAdapter.execute !==
      "function"
  ) {
    throw executorError(
      "explicit deletion adapter dependencies are required.",
    );
  }

  const boundManifest =
    manifest;

  const byId =
    componentMap(
      boundManifest,
    );

  return Object.freeze({
    async executeStep(
      input:
        Readonly<
          BusinessDeletionExecutionPortInput
        >,
    ): Promise<
      Readonly<
        BusinessDeletionExecutionPortResult
      >
    > {
      assertBoundInput(
        boundManifest,
        input,
      );

      const step =
        input.step;

      const components =
        requestedComponents(
          byId,
          step,
        );

      if (
        step.kind ===
        "dynamodb-transaction"
      ) {
        if (
          step.componentDeleteCount !==
            step.componentIds.length ||
          step.componentDeleteCount !==
            components.length
        ) {
          throw executorError(
            "DynamoDB step component count does not match the bound manifest.",
          );
        }

        if (
          step.transactionActionCount !==
            step.componentDeleteCount +
            BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS
        ) {
          throw executorError(
            "DynamoDB step transaction action count is invalid.",
          );
        }

        const estimatedItemBytes =
          components.reduce(
            (
              total,
              component,
            ) => {
              if (
                component.locator.system !==
                "dynamodb"
              ) {
                return total;
              }

              return (
                total +
                component.locator
                  .estimatedItemBytes
              );
            },
            0,
          );

        if (
          estimatedItemBytes !==
          step.estimatedItemBytes
        ) {
          throw executorError(
            "DynamoDB step byte estimate does not match the bound manifest.",
          );
        }

        const targets =
          Object.freeze(
            components.map(
              (
                component,
              ) =>
                dynamoTarget(
                  component,
                  step
                    .awsAccountId,
                  step
                    .awsRegion,
                ),
            ),
          );

        const adapterResult =
          await dependencies
            .dynamoDbAdapter
            .execute(
              Object.freeze({
                schemaVersion:
                  BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
                operationId:
                  boundManifest
                    .operationId,
                manifestIntegrityDigest:
                  boundManifest
                    .manifestIntegrityDigest,
                stepIndex:
                  input.stepIndex,
                stepId:
                  step.stepId,
                attemptTokenDigest:
                  input.attemptTokenDigest,
                attemptNumber:
                  input.attemptNumber,
                requiredLegalHoldVersion:
                  step
                    .requiredLegalHoldVersion,
                targets,
              }),
            );

        return verifiedResult(
          step.componentIds,
          adapterResult,
        );
      }

      if (
        step.componentIds.length !==
          1 ||
        components.length !==
          1
      ) {
        throw executorError(
          "external step must resolve exactly one bound component.",
        );
      }

      const component =
        components[0];

      if (!component) {
        throw executorError(
          "external step component is missing.",
        );
      }

      const target =
        externalTarget(
          component,
          step.systemRole,
        );

      const adapterResult =
        await dependencies
          .externalAdapter
          .execute(
            Object.freeze({
              schemaVersion:
                BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
              operationId:
                boundManifest
                  .operationId,
              manifestIntegrityDigest:
                boundManifest
                  .manifestIntegrityDigest,
              stepIndex:
                input.stepIndex,
              stepId:
                step.stepId,
              attemptTokenDigest:
                input.attemptTokenDigest,
              attemptNumber:
                input.attemptNumber,
              requiredLegalHoldVersion:
                step
                  .requiredLegalHoldVersion,
              target,
            }),
          );

      return verifiedResult(
        step.componentIds,
        adapterResult,
      );
    },
  });
}
