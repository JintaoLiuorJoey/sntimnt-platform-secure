import {
  BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
  type BusinessDeletionAbsenceVerifier,
  type BusinessDeletionDynamoDbAbsenceVerification,
  type BusinessDeletionDynamoDbAbsenceVerifierInput,
  type BusinessDeletionDynamoDbTarget,
  type BusinessDeletionDynamoDbTransactionReceipt,
} from "./business-deletion-executor.js";
import {
  resolveBusinessItemGenerationForDeletion,
  type BusinessItemGenerationReader,
} from "./business-item-generation.js";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const COMPONENT_ID_PATTERN =
  /^[a-z0-9][a-z0-9_-]{2,63}$/;

const AWS_ACCOUNT_ID_PATTERN =
  /^\d{12}$/;

const AWS_REGION_PATTERN =
  /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/;

const KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9#:_./@+-]{0,1023}$/;

function verifierError(
  message:
    string,
): Error {
  return new Error(
    `Deletion absence verifier refused: ${message}`,
  );
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
    throw verifierError(
      `${name} is invalid.`,
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
    throw verifierError(
      `${name} is invalid.`,
    );
  }

  return value;
}

function exactUniqueSet(
  expected:
    readonly string[],
  actual:
    readonly string[],
): boolean {
  if (
    expected.length !==
      actual.length ||
    new Set(expected).size !==
      expected.length ||
    new Set(actual).size !==
      actual.length
  ) {
    return false;
  }

  const actualSet =
    new Set(actual);

  return expected.every(
    (value) =>
      actualSet.has(value),
  );
}

function frozenTarget(
  target:
    Readonly<BusinessDeletionDynamoDbTarget>,
): Readonly<BusinessDeletionDynamoDbTarget> {
  if (
    !target ||
    !COMPONENT_ID_PATTERN.test(
      target.componentId,
    ) ||
    target.tableRole !==
      "business-table" ||
    !AWS_ACCOUNT_ID_PATTERN.test(
      target.awsAccountId,
    ) ||
    !AWS_REGION_PATTERN.test(
      target.awsRegion,
    ) ||
    !KEY_PATTERN.test(
      target.partitionKey,
    ) ||
    !KEY_PATTERN.test(
      target.sortKey,
    ) ||
    !target.itemGenerationPrecondition ||
    target.itemGenerationPrecondition.mode !==
      "exact-generation-or-absent" ||
    target.itemGenerationPrecondition.partitionKeyAttributeName !==
      "pk" ||
    target.itemGenerationPrecondition.sortKeyAttributeName !==
      "sk" ||
    target.itemGenerationPrecondition.generationAttributeName !==
      "deletionGuardDigest" ||
    !SHA256_PATTERN.test(
      target.itemGenerationPrecondition.expectedGenerationDigest,
    )
  ) {
    throw verifierError(
      "a target is invalid.",
    );
  }

  return Object.freeze({
    componentId:
      target.componentId,
    tableRole:
      target.tableRole,
    awsAccountId:
      target.awsAccountId,
    awsRegion:
      target.awsRegion,
    partitionKey:
      target.partitionKey,
    sortKey:
      target.sortKey,
    itemGenerationPrecondition:
      Object.freeze({
        ...target.itemGenerationPrecondition,
      }),
  });
}

function validatedTargets(
  targets:
    readonly BusinessDeletionDynamoDbTarget[],
): readonly Readonly<BusinessDeletionDynamoDbTarget>[] {
  if (
    !Array.isArray(
      targets,
    ) ||
    targets.length < 1
  ) {
    throw verifierError(
      "at least one exact DynamoDB target is required.",
    );
  }

  const frozen =
    targets.map(
      frozenTarget,
    );

  const componentIds =
    frozen.map(
      (target) =>
        target.componentId,
    );

  if (
    new Set(
      componentIds,
    ).size !==
      componentIds.length
  ) {
    throw verifierError(
      "target component identifiers must be unique.",
    );
  }

  const physicalKeys =
    frozen.map(
      (target) =>
        `${target.partitionKey}\u0000${target.sortKey}`,
    );

  if (
    new Set(
      physicalKeys,
    ).size !==
      physicalKeys.length
  ) {
    throw verifierError(
      "the same DynamoDB item cannot be verified twice.",
    );
  }

  const accountId =
    frozen[0]!.awsAccountId;
  const region =
    frozen[0]!.awsRegion;

  if (
    frozen.some(
      (target) =>
        target.awsAccountId !==
          accountId ||
        target.awsRegion !==
          region,
    )
  ) {
    throw verifierError(
      "all targets must share one AWS account and Region.",
    );
  }

  return Object.freeze(
    frozen,
  );
}

function validateReceipt(
  input:
    Readonly<BusinessDeletionDynamoDbAbsenceVerifierInput>,
  targets:
    readonly Readonly<BusinessDeletionDynamoDbTarget>[],
): Readonly<BusinessDeletionDynamoDbTransactionReceipt> {
  const receipt =
    input.transactionReceipt;
  const componentIds =
    targets.map(
      (target) =>
        target.componentId,
    );

  if (
    !receipt ||
    receipt.outcome !==
      "transaction-accepted" ||
    receipt.operationId !==
      input.operationId ||
    receipt.manifestIntegrityDigest !==
      input.manifestIntegrityDigest ||
    receipt.stepIndex !==
      input.stepIndex ||
    receipt.stepId !==
      input.stepId ||
    receipt.attemptTokenDigest !==
      input.attemptTokenDigest ||
    !Array.isArray(
      receipt.componentIds,
    ) ||
    !exactUniqueSet(
      componentIds,
      receipt.componentIds,
    ) ||
    receipt.awsAccountId !==
      targets[0]!.awsAccountId ||
    receipt.awsRegion !==
      targets[0]!.awsRegion ||
    !SHA256_PATTERN.test(
      receipt.transactionRequestDigest,
    )
  ) {
    throw verifierError(
      "the transaction receipt does not match the exact verification request.",
    );
  }

  canonicalTimestamp(
    receipt.acceptedAt,
    "transaction acceptance time",
  );

  return Object.freeze({
    ...receipt,
    componentIds:
      Object.freeze([
        ...receipt.componentIds,
      ]),
  });
}

export class BusinessDeletionDynamoDbAbsenceVerifier
  implements BusinessDeletionAbsenceVerifier {
  constructor(
    private readonly reader:
      BusinessItemGenerationReader,
    private readonly now:
      () => string =
        () =>
          new Date()
            .toISOString(),
  ) {
    if (
      !reader ||
      typeof reader.readGeneration !==
        "function" ||
      typeof now !==
        "function"
    ) {
      throw new Error(
        "Deletion absence verifier dependencies are invalid.",
      );
    }
  }

  async verifyAbsent(
    input:
      Readonly<BusinessDeletionDynamoDbAbsenceVerifierInput>,
  ): Promise<
    Readonly<BusinessDeletionDynamoDbAbsenceVerification>
  > {
    if (
      !input ||
      input.schemaVersion !==
        BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION ||
      !UUID_V4_PATTERN.test(
        input.operationId,
      ) ||
      !SHA256_PATTERN.test(
        input.manifestIntegrityDigest,
      ) ||
      !Number.isSafeInteger(
        input.stepIndex,
      ) ||
      input.stepIndex < 0 ||
      typeof input.stepId !==
        "string" ||
      input.stepId.trim() !==
        input.stepId ||
      input.stepId.length < 1 ||
      !SHA256_PATTERN.test(
        input.attemptTokenDigest,
      )
    ) {
      throw verifierError(
        "the verification request is invalid.",
      );
    }

    const targets =
      validatedTargets(
        input.targets,
      );

    const receipt =
      validateReceipt(
        input,
        targets,
      );

    for (
      const target of
      targets
    ) {
      const resolution =
        await resolveBusinessItemGenerationForDeletion(
          this.reader,
          {
            partitionKey:
              target.partitionKey,
            sortKey:
              target.sortKey,
          },
        );

      if (
        resolution.outcome ===
          "migration-required"
      ) {
        throw verifierError(
          `target ${target.componentId} has no verifiable generation.`,
        );
      }

      if (
        resolution.outcome ===
          "ready-for-deletion-manifest" &&
        resolution.itemGenerationPrecondition
          .expectedGenerationDigest ===
          target.itemGenerationPrecondition
            .expectedGenerationDigest
      ) {
        throw verifierError(
          `target ${target.componentId} planned generation remains present.`,
        );
      }
    }

    const verifiedAt =
      canonicalTimestamp(
        this.now(),
        "absence verification time",
      );

    if (
      Date.parse(
        verifiedAt,
      ) <
      Date.parse(
        receipt.acceptedAt,
      )
    ) {
      throw verifierError(
        "absence verification time precedes transaction acceptance.",
      );
    }

    return Object.freeze({
      outcome:
        "absence-verified",
      operationId:
        receipt.operationId,
      manifestIntegrityDigest:
        receipt.manifestIntegrityDigest,
      stepIndex:
        receipt.stepIndex,
      stepId:
        receipt.stepId,
      attemptTokenDigest:
        receipt.attemptTokenDigest,
      componentIds:
        Object.freeze(
          targets.map(
            (target) =>
              target.componentId,
          ),
        ),
      awsAccountId:
        targets[0]!.awsAccountId,
      awsRegion:
        targets[0]!.awsRegion,
      transactionRequestDigest:
        receipt.transactionRequestDigest,
      verifiedAt:
        verifiedAt,
    });
  }
}
