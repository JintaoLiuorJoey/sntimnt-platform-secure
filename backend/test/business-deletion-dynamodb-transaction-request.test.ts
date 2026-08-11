import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

import {
  BUSINESS_DELETION_DYNAMODB_TRANSACTION_REQUEST_BOUNDARY,
  BusinessDeletionDynamoDbTransactionRequestBuilder,
} from "../src/business-deletion-dynamodb-transaction-request.js";
import {
  BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
  businessDeletionDynamoDbTransactionRequestDigest,
  type BusinessDeletionDynamoDbTarget,
  type BusinessDeletionDynamoDbTransactionAdapterInput,
} from "../src/business-deletion-executor.js";

const OPERATION_ID =
  "123e4567-e89b-42d3-a456-426614174000";

const OWNER =
  "BUSINESS#OWNER#XKkzH4i6IJ7oBTSPcL88KKr-qWsX35sJjZsR3Q7lsCY";

const HASH_A =
  "a".repeat(64);

const HASH_B =
  "b".repeat(64);

const HASH_C =
  "c".repeat(64);

function target(
  componentId:
    string,
  suffix:
    string,
  generation:
    string = HASH_C,
): BusinessDeletionDynamoDbTarget {
  return {
    componentId,
    tableRole:
      "business-table",
    awsAccountId:
      "123456789012",
    awsRegion:
      "us-east-1",
    partitionKey:
      OWNER,
    sortKey:
      `BUSINESS#INVESTMENT_ACCOUNT#${suffix}`,
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
        generation,
    },
  };
}

function adapterInput(
  overrides:
    Partial<BusinessDeletionDynamoDbTransactionAdapterInput> = {},
): BusinessDeletionDynamoDbTransactionAdapterInput {
  const unsigned = {
    operationId:
      OPERATION_ID,
    manifestIntegrityDigest:
      HASH_A,
    stepIndex:
      1,
    stepId:
      "dynamodb-step-001",
    attemptTokenDigest:
      HASH_B,
    attemptNumber:
      1,
    requiredLegalHoldVersion:
      7,
    targets:
      [
        target(
          "primary_item",
          "acct_000000000001",
        ),
        target(
          "derived_item",
          "acct_000000000002",
          HASH_A,
        ),
      ],
    ...overrides,
  };

  return {
    schemaVersion:
      BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
    ...unsigned,
    transactionRequestDigest:
      businessDeletionDynamoDbTransactionRequestDigest(
        unsigned,
      ),
  };
}

function builder() {
  return new BusinessDeletionDynamoDbTransactionRequestBuilder({
    awsAccountId:
      "123456789012",
    awsRegion:
      "us-east-1",
    tableName:
      "business-table",
    deletionControlTableName:
      "deletion-control-table",
  });
}

describe(
  "business deletion DynamoDB transaction request contracts",
  () => {
    it("declares a request-only boundary without command construction or execution", () => {
      expect(
        BUSINESS_DELETION_DYNAMODB_TRANSACTION_REQUEST_BOUNDARY,
      ).toEqual({
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
      });
    });

    it("builds one exact conditional delete action per target", () => {
      const input =
        adapterInput();

      const prepared =
        builder().build(
          input,
        );

      expect(
        prepared,
      ).toMatchObject({
        schemaVersion:
          1,
        operationId:
          OPERATION_ID,
        manifestIntegrityDigest:
          HASH_A,
        stepIndex:
          1,
        stepId:
          "dynamodb-step-001",
        attemptTokenDigest:
          HASH_B,
        attemptNumber:
          1,
        requiredLegalHoldVersion:
          7,
        awsAccountId:
          "123456789012",
        awsRegion:
          "us-east-1",
        tableName:
          "business-table",
        deletionControlTableName:
          "deletion-control-table",
        componentIds: [
          "primary_item",
          "derived_item",
        ],
        transactionRequestDigest:
          input.transactionRequestDigest,
        transactionActionCount:
          4,
        request: {
          ClientRequestToken:
            input.transactionRequestDigest.slice(
              0,
              36,
            ),
          ReturnConsumedCapacity:
            "NONE",
          ReturnItemCollectionMetrics:
            "NONE",
        },
      });

      expect(
        prepared.request.TransactItems,
      ).toEqual([
        {
          ConditionCheck: {
            TableName:
              "deletion-control-table",
            Key: {
              pk: {
                S:
                  `DEL#OP#${OPERATION_ID}`,
              },
              sk: {
                S:
                  "ROOT",
              },
            },
            ConditionExpression:
              "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #operationId = :operationId AND #manifestIntegrityDigest = :manifestIntegrityDigest AND #state = :state AND #legalHoldVersion = :requiredLegalHoldVersion",
            ExpressionAttributeNames: {
              "#pk": "pk",
              "#sk": "sk",
              "#kind": "kind",
              "#operationId":
                "operationId",
              "#manifestIntegrityDigest":
                "manifestIntegrityDigest",
              "#state": "state",
              "#legalHoldVersion":
                "legalHoldVersion",
            },
            ExpressionAttributeValues: {
              ":kind": {
                S:
                  "operation-root",
              },
              ":operationId": {
                S:
                  OPERATION_ID,
              },
              ":manifestIntegrityDigest": {
                S:
                  HASH_A,
              },
              ":state": {
                S:
                  "executing",
              },
              ":requiredLegalHoldVersion": {
                N:
                  "7",
              },
            },
            ReturnValuesOnConditionCheckFailure:
              "NONE",
          },
        },
        {
          ConditionCheck: {
            TableName:
              "deletion-control-table",
            Key: {
              pk: {
                S:
                  `DEL#OP#${OPERATION_ID}`,
              },
              sk: {
                S:
                  "STEP#000001",
              },
            },
            ConditionExpression:
              "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #operationId = :operationId AND #manifestIntegrityDigest = :manifestIntegrityDigest AND #state = :state AND #leaseVersion = :attemptNumber AND #leaseTokenDigest = :attemptTokenDigest",
            ExpressionAttributeNames: {
              "#pk": "pk",
              "#sk": "sk",
              "#kind": "kind",
              "#operationId":
                "operationId",
              "#manifestIntegrityDigest":
                "manifestIntegrityDigest",
              "#state": "state",
              "#leaseVersion":
                "leaseVersion",
              "#leaseTokenDigest":
                "leaseTokenDigest",
            },
            ExpressionAttributeValues: {
              ":kind": {
                S:
                  "progress",
              },
              ":operationId": {
                S:
                  OPERATION_ID,
              },
              ":manifestIntegrityDigest": {
                S:
                  HASH_A,
              },
              ":state": {
                S:
                  "executing",
              },
              ":attemptNumber": {
                N:
                  "1",
              },
              ":attemptTokenDigest": {
                S:
                  HASH_B,
              },
            },
            ReturnValuesOnConditionCheckFailure:
              "NONE",
          },
        },
        {
          Delete: {
            TableName:
              "business-table",
            Key: {
              pk: {
                S:
                  OWNER,
              },
              sk: {
                S:
                  "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000001",
              },
            },
            ConditionExpression:
              "(attribute_not_exists(#pk) AND attribute_not_exists(#sk)) OR #generation = :expectedGeneration",
            ExpressionAttributeNames: {
              "#pk": "pk",
              "#sk": "sk",
              "#generation":
                "deletionGuardDigest",
            },
            ExpressionAttributeValues: {
              ":expectedGeneration": {
                S:
                  HASH_C,
              },
            },
            ReturnValuesOnConditionCheckFailure:
              "NONE",
          },
        },
        {
          Delete: {
            TableName:
              "business-table",
            Key: {
              pk: {
                S:
                  OWNER,
              },
              sk: {
                S:
                  "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000002",
              },
            },
            ConditionExpression:
              "(attribute_not_exists(#pk) AND attribute_not_exists(#sk)) OR #generation = :expectedGeneration",
            ExpressionAttributeNames: {
              "#pk": "pk",
              "#sk": "sk",
              "#generation":
                "deletionGuardDigest",
            },
            ExpressionAttributeValues: {
              ":expectedGeneration": {
                S:
                  HASH_A,
              },
            },
            ReturnValuesOnConditionCheckFailure:
              "NONE",
          },
        },
      ]);
    });

    it("deep-freezes prepared request metadata and delete actions", () => {
      const prepared =
        builder().build(
          adapterInput(),
        );

      const operationCheck =
        prepared.request.TransactItems[0];
      const firstDelete =
        prepared.request.TransactItems[2];

      if (
        !operationCheck ||
        !("ConditionCheck" in operationCheck) ||
        !firstDelete ||
        !("Delete" in firstDelete)
      ) {
        throw new Error(
          "Expected control checks before delete actions.",
        );
      }

      expect(
        Object.isFrozen(
          prepared,
        ),
      ).toBe(true);

      expect(
        Object.isFrozen(
          prepared.componentIds,
        ),
      ).toBe(true);

      expect(
        Object.isFrozen(
          prepared.request,
        ),
      ).toBe(true);

      expect(
        Object.isFrozen(
          prepared.request.TransactItems,
        ),
      ).toBe(true);

      expect(
        Object.isFrozen(
          operationCheck.ConditionCheck
            .Key.pk,
        ),
      ).toBe(true);

      expect(
        Object.isFrozen(
          firstDelete.Delete.Key.pk,
        ),
      ).toBe(true);
    });

    it("derives a deterministic 36-character token from the exact canonical request digest", () => {
      const firstInput =
        adapterInput();
      const secondInput =
        adapterInput({
          attemptNumber:
            2,
        });

      const first =
        builder().build(
          firstInput,
        );
      const repeated =
        builder().build(
          firstInput,
        );
      const second =
        builder().build(
          secondInput,
        );

      expect(
        first.request.ClientRequestToken,
      ).toHaveLength(36);

      expect(
        repeated.request.ClientRequestToken,
      ).toBe(
        first.request.ClientRequestToken,
      );

      expect(
        second.request.ClientRequestToken,
      ).not.toBe(
        first.request.ClientRequestToken,
      );
    });

    it("rejects a request digest that does not match the exact adapter input", () => {
      const input =
        adapterInput();

      expect(
        () =>
          builder().build({
            ...input,
            transactionRequestDigest:
              HASH_C,
          }),
      ).toThrow(
        "transaction request digest does not match",
      );
    });

    it("rejects zero-based control-record versions and step indexes", () => {
      for (
        const overrides of
        [
          {
            stepIndex:
              0,
          },
          {
            requiredLegalHoldVersion:
              0,
          },
        ]
      ) {
        expect(
          () =>
            builder().build(
              adapterInput(
                overrides,
              ),
            ),
        ).toThrow(
          "adapter input is invalid",
        );
      }
    });

    it("binds each target to the configured AWS account, Region, and table role", () => {
      const wrongAccount =
        adapterInput({
          targets: [
            {
              ...target(
                "primary_item",
                "acct_000000000001",
              ),
              awsAccountId:
                "999999999999",
            },
          ],
        });

      const wrongRegion =
        adapterInput({
          targets: [
            {
              ...target(
                "primary_item",
                "acct_000000000001",
              ),
              awsRegion:
                "us-west-2",
            },
          ],
        });

      for (
        const input of
        [
          wrongAccount,
          wrongRegion,
        ]
      ) {
        expect(
          () =>
            builder().build(
              input,
            ),
        ).toThrow(
          "target or its infrastructure boundary is invalid",
        );
      }
    });

    it("rejects duplicate component identifiers and duplicate physical keys", () => {
      const duplicateIds =
        adapterInput({
          targets: [
            target(
              "same_item",
              "acct_000000000001",
            ),
            target(
              "same_item",
              "acct_000000000002",
            ),
          ],
        });

      expect(
        () =>
          builder().build(
            duplicateIds,
          ),
      ).toThrow(
        "component identifiers must be unique",
      );

      const duplicateKeys =
        adapterInput({
          targets: [
            target(
              "first_item",
              "acct_000000000001",
              HASH_A,
            ),
            target(
              "second_item",
              "acct_000000000001",
              HASH_B,
            ),
          ],
        });

      expect(
        () =>
          builder().build(
            duplicateKeys,
          ),
      ).toThrow(
        "same DynamoDB item cannot appear twice",
      );
    });

    it("rejects malformed or weakened item-generation conditions", () => {
      const malformed = {
        ...target(
          "primary_item",
          "acct_000000000001",
        ),
        itemGenerationPrecondition: {
          ...target(
            "primary_item",
            "acct_000000000001",
          ).itemGenerationPrecondition,
          mode:
            "attribute-exists-only",
        },
      } as unknown as BusinessDeletionDynamoDbTarget;

      expect(
        () =>
          builder().build(
            adapterInput({
              targets: [
                malformed,
              ],
            }),
          ),
      ).toThrow(
        "target or its infrastructure boundary is invalid",
      );
    });

    it("allows exactly 98 business deletes while reserving two transaction actions", () => {
      const targets =
        Array.from(
          {
            length:
              98,
          },
          (
            _value,
            index,
          ) =>
            target(
              `item_${String(
                index,
              ).padStart(
                3,
                "0",
              )}`,
              `acct_${String(
                index,
              ).padStart(
                12,
                "0",
              )}`,
            ),
        );

      const prepared =
        builder().build(
          adapterInput({
            targets,
          }),
        );

      expect(
        prepared.request.TransactItems,
      ).toHaveLength(100);

      expect(
        prepared.transactionActionCount,
      ).toBe(100);
    });

    it("rejects 99 business deletes to preserve the two reserved transaction actions", () => {
      const targets =
        Array.from(
          {
            length:
              99,
          },
          (
            _value,
            index,
          ) =>
            target(
              `item_${String(
                index,
              ).padStart(
                3,
                "0",
              )}`,
              `acct_${String(
                index,
              ).padStart(
                12,
                "0",
              )}`,
            ),
        );

      expect(
        () =>
          builder().build(
            adapterInput({
              targets,
            }),
          ),
      ).toThrow(
        "adapter input is invalid",
      );
    });

    it("rejects malformed configuration before preparing a request", () => {
      for (
        const config of
        [
          {
            awsAccountId:
              "not-an-account",
            awsRegion:
              "us-east-1",
            tableName:
              "business-table",
            deletionControlTableName:
              "deletion-control-table",
          },
          {
            awsAccountId:
              "123456789012",
            awsRegion:
              " us-east-1",
            tableName:
              "business-table",
            deletionControlTableName:
              "deletion-control-table",
          },
          {
            awsAccountId:
              "123456789012",
            awsRegion:
              "us-east-1",
            tableName:
              "bad table",
            deletionControlTableName:
              "deletion-control-table",
          },
          {
            awsAccountId:
              "123456789012",
            awsRegion:
              "us-east-1",
            tableName:
              "business-table",
            deletionControlTableName:
              "bad table",
          },
          {
            awsAccountId:
              "123456789012",
            awsRegion:
              "us-east-1",
            tableName:
              "business-table",
            deletionControlTableName:
              "business-table",
          },
        ]
      ) {
        expect(
          () =>
            new BusinessDeletionDynamoDbTransactionRequestBuilder(
              config,
            ),
        ).toThrow(
          "configuration is invalid",
        );
      }
    });

    it("keeps request preparation free of SDK commands, clients, sends, receipts, runtime, and infrastructure wiring", () => {
      const source =
        readFileSync(
          new URL(
            "../src/business-deletion-dynamodb-transaction-request.ts",
            import.meta.url,
          ),
          "utf8",
        );

      for (
        const forbidden of
        [
          "@aws-sdk/",
          "DynamoDBClient",
          "TransactWriteItemsCommand",
          "DeleteItemCommand",
          ".send(",
          "transaction-accepted",
          "acceptedAt",
          "process.env",
          "BUSINESS_TABLE_NAME",
          "./handler",
          "business-runtime",
          "template.yaml",
        ]
      ) {
        expect(
          source,
        ).not.toContain(
          forbidden,
        );
      }

      expect(
        source,
      ).toContain(
        "ReturnValuesOnConditionCheckFailure",
      );

      expect(
        source,
      ).toContain(
        "attribute_not_exists(#pk)",
      );
    });
  },
);
