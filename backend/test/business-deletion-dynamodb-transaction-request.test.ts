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
      0,
    stepId:
      "dynamodb-step-000",
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
        stepIndex:
          0,
        stepId:
          "dynamodb-step-000",
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
        componentIds: [
          "primary_item",
          "derived_item",
        ],
        transactionRequestDigest:
          input.transactionRequestDigest,
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
          prepared.request.TransactItems[0]?.Delete.Key.pk,
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
      ).toHaveLength(98);
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
          },
          {
            awsAccountId:
              "123456789012",
            awsRegion:
              " us-east-1",
            tableName:
              "business-table",
          },
          {
            awsAccountId:
              "123456789012",
            awsRegion:
              "us-east-1",
            tableName:
              "bad table",
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
