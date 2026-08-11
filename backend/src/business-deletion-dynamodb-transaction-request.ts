import {
  BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS,
  DYNAMODB_TRANSACTION_ACTION_LIMIT,
} from "./business-deletion-execution.js";
import {
  businessDeletionControlOperationKey,
  businessDeletionControlProgressKey,
} from "./business-deletion-control-store.js";
import {
  BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
  businessDeletionDynamoDbTransactionRequestDigest,
  type BusinessDeletionDynamoDbTarget,
  type BusinessDeletionDynamoDbTransactionAdapterInput,
} from "./business-deletion-executor.js";

export const BUSINESS_DELETION_DYNAMODB_TRANSACTION_REQUEST_SCHEMA_VERSION =
  1 as const;

export const BUSINESS_DELETION_DYNAMODB_TRANSACTION_REQUEST_BOUNDARY =
  Object.freeze({
    output:
      "frozen-request-data-only",
    requestDigest:
      "executor-canonical-recomputation",
    idempotencyToken:
      "request-digest-prefix-144-bit",
    itemCondition:
      "exact-generation-or-absent",
    reservedActions:
      "operation-and-attempt-condition-checks",
    operationFence:
      "executing-exact-manifest-and-legal-hold-version",
    attemptFence:
      "executing-exact-manifest-lease-version-and-token",
    controlTableMutation:
      false,
    returnValuesOnConditionFailure:
      "NONE",
    awsSdkCommand:
      false,
    clientSend:
      false,
    receiptIssuance:
      false,
    runtimeWiring:
      false,
    infrastructureChange:
      false,
  } as const);

export interface BusinessDeletionDynamoDbTransactionRequestConfig {
  readonly awsAccountId:
    string;
  readonly awsRegion:
    string;
  readonly tableName:
    string;
  readonly deletionControlTableName:
    string;
}

export interface BusinessDeletionDynamoDbOperationConditionCheckAction {
  readonly ConditionCheck:
    Readonly<{
      TableName:
        string;
      Key:
        Readonly<{
          pk:
            Readonly<{
              S:
                string;
            }>;
          sk:
            Readonly<{
              S:
                string;
            }>;
        }>;
      ConditionExpression:
        "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #operationId = :operationId AND #manifestIntegrityDigest = :manifestIntegrityDigest AND #state = :state AND #legalHoldVersion = :requiredLegalHoldVersion";
      ExpressionAttributeNames:
        Readonly<{
          "#pk": "pk";
          "#sk": "sk";
          "#kind": "kind";
          "#operationId": "operationId";
          "#manifestIntegrityDigest": "manifestIntegrityDigest";
          "#state": "state";
          "#legalHoldVersion": "legalHoldVersion";
        }>;
      ExpressionAttributeValues:
        Readonly<{
          ":kind": Readonly<{ S: "operation-root" }>;
          ":operationId": Readonly<{ S: string }>;
          ":manifestIntegrityDigest": Readonly<{ S: string }>;
          ":state": Readonly<{ S: "executing" }>;
          ":requiredLegalHoldVersion": Readonly<{ N: string }>;
        }>;
      ReturnValuesOnConditionCheckFailure:
        "NONE";
    }>;
}

export interface BusinessDeletionDynamoDbAttemptConditionCheckAction {
  readonly ConditionCheck:
    Readonly<{
      TableName:
        string;
      Key:
        Readonly<{
          pk:
            Readonly<{
              S:
                string;
            }>;
          sk:
            Readonly<{
              S:
                string;
            }>;
        }>;
      ConditionExpression:
        "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #operationId = :operationId AND #manifestIntegrityDigest = :manifestIntegrityDigest AND #state = :state AND #leaseVersion = :attemptNumber AND #leaseTokenDigest = :attemptTokenDigest";
      ExpressionAttributeNames:
        Readonly<{
          "#pk": "pk";
          "#sk": "sk";
          "#kind": "kind";
          "#operationId": "operationId";
          "#manifestIntegrityDigest": "manifestIntegrityDigest";
          "#state": "state";
          "#leaseVersion": "leaseVersion";
          "#leaseTokenDigest": "leaseTokenDigest";
        }>;
      ExpressionAttributeValues:
        Readonly<{
          ":kind": Readonly<{ S: "progress" }>;
          ":operationId": Readonly<{ S: string }>;
          ":manifestIntegrityDigest": Readonly<{ S: string }>;
          ":state": Readonly<{ S: "executing" }>;
          ":attemptNumber": Readonly<{ N: string }>;
          ":attemptTokenDigest": Readonly<{ S: string }>;
        }>;
      ReturnValuesOnConditionCheckFailure:
        "NONE";
    }>;
}

export interface BusinessDeletionDynamoDbDeleteAction {
  readonly Delete:
    Readonly<{
      TableName:
        string;
      Key:
        Readonly<{
          pk:
            Readonly<{
              S:
                string;
            }>;
          sk:
            Readonly<{
              S:
                string;
            }>;
        }>;
      ConditionExpression:
        "(attribute_not_exists(#pk) AND attribute_not_exists(#sk)) OR #generation = :expectedGeneration";
      ExpressionAttributeNames:
        Readonly<{
          "#pk":
            "pk";
          "#sk":
            "sk";
          "#generation":
            "deletionGuardDigest";
        }>;
      ExpressionAttributeValues:
        Readonly<{
          ":expectedGeneration":
            Readonly<{
              S:
                string;
            }>;
        }>;
      ReturnValuesOnConditionCheckFailure:
        "NONE";
    }>;
}

export type BusinessDeletionDynamoDbTransactionAction =
  | BusinessDeletionDynamoDbOperationConditionCheckAction
  | BusinessDeletionDynamoDbAttemptConditionCheckAction
  | BusinessDeletionDynamoDbDeleteAction;

export interface BusinessDeletionDynamoDbPreparedTransactionRequest {
  readonly schemaVersion:
    typeof BUSINESS_DELETION_DYNAMODB_TRANSACTION_REQUEST_SCHEMA_VERSION;
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
  readonly awsAccountId:
    string;
  readonly awsRegion:
    string;
  readonly tableName:
    string;
  readonly deletionControlTableName:
    string;
  readonly componentIds:
    readonly string[];
  readonly transactionRequestDigest:
    string;
  readonly transactionActionCount:
    number;
  readonly request:
    Readonly<{
      TransactItems:
        readonly Readonly<BusinessDeletionDynamoDbTransactionAction>[];
      ClientRequestToken:
        string;
      ReturnConsumedCapacity:
        "NONE";
      ReturnItemCollectionMetrics:
        "NONE";
    }>;
}

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

const DYNAMODB_TABLE_NAME_PATTERN =
  /^[A-Za-z0-9_.-]{3,255}$/;

const KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9#:_./@+-]{0,1023}$/;

const MAX_DELETE_ACTIONS =
  DYNAMODB_TRANSACTION_ACTION_LIMIT -
  BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS;

function requestError(
  message:
    string,
): Error {
  return new Error(
    `Deletion transaction request refused: ${message}`,
  );
}

function canonicalConfig(
  config:
    Readonly<BusinessDeletionDynamoDbTransactionRequestConfig>,
): Readonly<BusinessDeletionDynamoDbTransactionRequestConfig> {
  if (
    !config ||
    !AWS_ACCOUNT_ID_PATTERN.test(
      config.awsAccountId,
    ) ||
    !AWS_REGION_PATTERN.test(
      config.awsRegion,
    ) ||
    !DYNAMODB_TABLE_NAME_PATTERN.test(
      config.tableName,
    ) ||
    !DYNAMODB_TABLE_NAME_PATTERN.test(
      config.deletionControlTableName,
    ) ||
    config.tableName ===
      config.deletionControlTableName
  ) {
    throw new Error(
      "Deletion transaction request configuration is invalid.",
    );
  }

  return Object.freeze({
    awsAccountId:
      config.awsAccountId,
    awsRegion:
      config.awsRegion,
    tableName:
      config.tableName,
    deletionControlTableName:
      config.deletionControlTableName,
  });
}

function operationConditionCheck(
  input:
    Readonly<BusinessDeletionDynamoDbTransactionAdapterInput>,
  tableName:
    string,
): Readonly<BusinessDeletionDynamoDbOperationConditionCheckAction> {
  const key =
    businessDeletionControlOperationKey(
      input.operationId,
    );

  return Object.freeze({
    ConditionCheck:
      Object.freeze({
        TableName:
          tableName,
        Key:
          Object.freeze({
            pk:
              Object.freeze({
                S:
                  key.pk,
              }),
            sk:
              Object.freeze({
                S:
                  key.sk,
              }),
          }),
        ConditionExpression:
          "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #operationId = :operationId AND #manifestIntegrityDigest = :manifestIntegrityDigest AND #state = :state AND #legalHoldVersion = :requiredLegalHoldVersion",
        ExpressionAttributeNames:
          Object.freeze({
            "#pk": "pk" as const,
            "#sk": "sk" as const,
            "#kind": "kind" as const,
            "#operationId":
              "operationId" as const,
            "#manifestIntegrityDigest":
              "manifestIntegrityDigest" as const,
            "#state": "state" as const,
            "#legalHoldVersion":
              "legalHoldVersion" as const,
          }),
        ExpressionAttributeValues:
          Object.freeze({
            ":kind":
              Object.freeze({
                S:
                  "operation-root" as const,
              }),
            ":operationId":
              Object.freeze({
                S:
                  input.operationId,
              }),
            ":manifestIntegrityDigest":
              Object.freeze({
                S:
                  input.manifestIntegrityDigest,
              }),
            ":state":
              Object.freeze({
                S:
                  "executing" as const,
              }),
            ":requiredLegalHoldVersion":
              Object.freeze({
                N:
                  String(
                    input.requiredLegalHoldVersion,
                  ),
              }),
          }),
        ReturnValuesOnConditionCheckFailure:
          "NONE" as const,
      }),
  });
}

function attemptConditionCheck(
  input:
    Readonly<BusinessDeletionDynamoDbTransactionAdapterInput>,
  tableName:
    string,
): Readonly<BusinessDeletionDynamoDbAttemptConditionCheckAction> {
  const key =
    businessDeletionControlProgressKey(
      input.operationId,
      input.stepIndex,
    );

  return Object.freeze({
    ConditionCheck:
      Object.freeze({
        TableName:
          tableName,
        Key:
          Object.freeze({
            pk:
              Object.freeze({
                S:
                  key.pk,
              }),
            sk:
              Object.freeze({
                S:
                  key.sk,
              }),
          }),
        ConditionExpression:
          "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #operationId = :operationId AND #manifestIntegrityDigest = :manifestIntegrityDigest AND #state = :state AND #leaseVersion = :attemptNumber AND #leaseTokenDigest = :attemptTokenDigest",
        ExpressionAttributeNames:
          Object.freeze({
            "#pk": "pk" as const,
            "#sk": "sk" as const,
            "#kind": "kind" as const,
            "#operationId":
              "operationId" as const,
            "#manifestIntegrityDigest":
              "manifestIntegrityDigest" as const,
            "#state": "state" as const,
            "#leaseVersion":
              "leaseVersion" as const,
            "#leaseTokenDigest":
              "leaseTokenDigest" as const,
          }),
        ExpressionAttributeValues:
          Object.freeze({
            ":kind":
              Object.freeze({
                S:
                  "progress" as const,
              }),
            ":operationId":
              Object.freeze({
                S:
                  input.operationId,
              }),
            ":manifestIntegrityDigest":
              Object.freeze({
                S:
                  input.manifestIntegrityDigest,
              }),
            ":state":
              Object.freeze({
                S:
                  "executing" as const,
              }),
            ":attemptNumber":
              Object.freeze({
                N:
                  String(
                    input.attemptNumber,
                  ),
              }),
            ":attemptTokenDigest":
              Object.freeze({
                S:
                  input.attemptTokenDigest,
              }),
          }),
        ReturnValuesOnConditionCheckFailure:
          "NONE" as const,
      }),
  });
}

function validatedTarget(
  target:
    Readonly<BusinessDeletionDynamoDbTarget>,
  config:
    Readonly<BusinessDeletionDynamoDbTransactionRequestConfig>,
): Readonly<BusinessDeletionDynamoDbTarget> {
  if (
    !target ||
    !COMPONENT_ID_PATTERN.test(
      target.componentId,
    ) ||
    target.tableRole !==
      "business-table" ||
    target.awsAccountId !==
      config.awsAccountId ||
    target.awsRegion !==
      config.awsRegion ||
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
    throw requestError(
      "a target or its infrastructure boundary is invalid.",
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

function deleteAction(
  target:
    Readonly<BusinessDeletionDynamoDbTarget>,
  tableName:
    string,
): Readonly<BusinessDeletionDynamoDbDeleteAction> {
  return Object.freeze({
    Delete:
      Object.freeze({
        TableName:
          tableName,
        Key:
          Object.freeze({
            pk:
              Object.freeze({
                S:
                  target.partitionKey,
              }),
            sk:
              Object.freeze({
                S:
                  target.sortKey,
              }),
          }),
        ConditionExpression:
          "(attribute_not_exists(#pk) AND attribute_not_exists(#sk)) OR #generation = :expectedGeneration",
        ExpressionAttributeNames:
          Object.freeze({
            "#pk": "pk" as const,
            "#sk": "sk" as const,
            "#generation":
              "deletionGuardDigest" as const,
          }),
        ExpressionAttributeValues:
          Object.freeze({
            ":expectedGeneration":
              Object.freeze({
                S:
                  target.itemGenerationPrecondition.expectedGenerationDigest,
              }),
          }),
        ReturnValuesOnConditionCheckFailure:
          "NONE" as const,
      }),
  });
}

export class BusinessDeletionDynamoDbTransactionRequestBuilder {
  private readonly config:
    Readonly<BusinessDeletionDynamoDbTransactionRequestConfig>;

  constructor(
    config:
      Readonly<BusinessDeletionDynamoDbTransactionRequestConfig>,
  ) {
    this.config =
      canonicalConfig(
        config,
      );
  }

  build(
    input:
      Readonly<BusinessDeletionDynamoDbTransactionAdapterInput>,
  ): Readonly<BusinessDeletionDynamoDbPreparedTransactionRequest> {
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
      input.stepIndex < 1 ||
      typeof input.stepId !==
        "string" ||
      input.stepId.trim() !==
        input.stepId ||
      input.stepId.length < 1 ||
      !SHA256_PATTERN.test(
        input.attemptTokenDigest,
      ) ||
      !Number.isSafeInteger(
        input.attemptNumber,
      ) ||
      input.attemptNumber < 1 ||
      !Number.isSafeInteger(
        input.requiredLegalHoldVersion,
      ) ||
      input.requiredLegalHoldVersion < 1 ||
      !Array.isArray(
        input.targets,
      ) ||
      input.targets.length < 1 ||
      input.targets.length >
        MAX_DELETE_ACTIONS ||
      !SHA256_PATTERN.test(
        input.transactionRequestDigest,
      )
    ) {
      throw requestError(
        "the adapter input is invalid.",
      );
    }

    const targets =
      input.targets.map(
        (target) =>
          validatedTarget(
            target,
            this.config,
          ),
      );

    const componentIds =
      targets.map(
        (target) =>
          target.componentId,
      );

    if (
      new Set(
        componentIds,
      ).size !==
        componentIds.length
    ) {
      throw requestError(
        "target component identifiers must be unique.",
      );
    }

    const physicalKeys =
      targets.map(
        (target) =>
          `${target.partitionKey}\u0000${target.sortKey}`,
      );

    if (
      new Set(
        physicalKeys,
      ).size !==
        physicalKeys.length
    ) {
      throw requestError(
        "the same DynamoDB item cannot appear twice.",
      );
    }

    const recomputedDigest =
      businessDeletionDynamoDbTransactionRequestDigest({
        operationId:
          input.operationId,
        manifestIntegrityDigest:
          input.manifestIntegrityDigest,
        stepIndex:
          input.stepIndex,
        stepId:
          input.stepId,
        attemptTokenDigest:
          input.attemptTokenDigest,
        attemptNumber:
          input.attemptNumber,
        requiredLegalHoldVersion:
          input.requiredLegalHoldVersion,
        targets,
      });

    if (
      recomputedDigest !==
        input.transactionRequestDigest
    ) {
      throw requestError(
        "the transaction request digest does not match the exact adapter input.",
      );
    }

    const deleteActions =
      Object.freeze(
        targets.map(
          (target) =>
            deleteAction(
              target,
              this.config.tableName,
            ),
        ),
      );

    const transactItems:
      readonly Readonly<BusinessDeletionDynamoDbTransactionAction>[] =
      Object.freeze([
        operationConditionCheck(
          input,
          this.config.deletionControlTableName,
        ),
        attemptConditionCheck(
          input,
          this.config.deletionControlTableName,
        ),
        ...deleteActions,
      ]);

    if (
      transactItems.length !==
        targets.length +
          BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS ||
      transactItems.length >
        DYNAMODB_TRANSACTION_ACTION_LIMIT
    ) {
      throw requestError(
        "the transaction action count is invalid.",
      );
    }

    return Object.freeze({
      schemaVersion:
        BUSINESS_DELETION_DYNAMODB_TRANSACTION_REQUEST_SCHEMA_VERSION,
      operationId:
        input.operationId,
      manifestIntegrityDigest:
        input.manifestIntegrityDigest,
      stepIndex:
        input.stepIndex,
      stepId:
        input.stepId,
      attemptTokenDigest:
        input.attemptTokenDigest,
      attemptNumber:
        input.attemptNumber,
      requiredLegalHoldVersion:
        input.requiredLegalHoldVersion,
      awsAccountId:
        this.config.awsAccountId,
      awsRegion:
        this.config.awsRegion,
      tableName:
        this.config.tableName,
      deletionControlTableName:
        this.config.deletionControlTableName,
      componentIds:
        Object.freeze([
          ...componentIds,
        ]),
      transactionRequestDigest:
        recomputedDigest,
      transactionActionCount:
        transactItems.length,
      request:
        Object.freeze({
          TransactItems:
            transactItems,
          ClientRequestToken:
            recomputedDigest.slice(
              0,
              36,
            ),
          ReturnConsumedCapacity:
            "NONE" as const,
          ReturnItemCollectionMetrics:
            "NONE" as const,
        }),
    });
  }
}
