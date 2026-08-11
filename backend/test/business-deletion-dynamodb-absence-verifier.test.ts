import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  BusinessDeletionDynamoDbAbsenceVerifier,
} from "../src/business-deletion-dynamodb-absence-verifier.js";
import {
  BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
  type BusinessDeletionDynamoDbAbsenceVerifierInput,
  type BusinessDeletionDynamoDbTarget,
} from "../src/business-deletion-executor.js";
import type {
  BusinessItemGenerationReader,
} from "../src/business-item-generation.js";

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

const VERIFIED_AT =
  "2026-08-11T10:00:00.000Z";

function target(
  componentId:
    string,
  suffix:
    string,
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
        HASH_C,
    },
  };
}

function request(
  overrides:
    Partial<BusinessDeletionDynamoDbAbsenceVerifierInput> = {},
): BusinessDeletionDynamoDbAbsenceVerifierInput {
  const targets =
    overrides.targets ??
    [
      target(
        "primary_item",
        "acct_000000000001",
      ),
      target(
        "derived_item",
        "acct_000000000002",
      ),
    ];

  return {
    schemaVersion:
      BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
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
    targets,
    transactionReceipt: {
      outcome:
        "transaction-accepted",
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
      componentIds:
        targets.map(
          (value) =>
            value.componentId,
        ),
      awsAccountId:
        "123456789012",
      awsRegion:
        "us-east-1",
      transactionRequestDigest:
        HASH_C,
      acceptedAt:
        "2026-08-11T09:59:59.000Z",
    },
    ...overrides,
  };
}

function absentReader() {
  return {
    readGeneration:
      vi.fn()
        .mockImplementation(
          async (
            key:
              Readonly<{
                partitionKey:
                  string;
                sortKey:
                  string;
              }>,
          ) => ({
            source:
              "business-table-generation-read" as const,
            consistency:
              "strongly-consistent" as const,
            outcome:
              "absent" as const,
            partitionKey:
              key.partitionKey,
            sortKey:
              key.sortKey,
          }),
        ),
  };
}

describe(
  "business deletion DynamoDB absence verifier",
  () => {
    it("verifies every exact target through the generation reader and returns bound evidence", async () => {
      const reader =
        absentReader();

      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          reader,
          () =>
            VERIFIED_AT,
        );

      const result =
        await verifier.verifyAbsent(
          request(),
        );

      expect(
        reader.readGeneration,
      ).toHaveBeenCalledTimes(2);

      expect(
        reader.readGeneration,
      ).toHaveBeenNthCalledWith(
        1,
        {
          partitionKey:
            OWNER,
          sortKey:
            "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000001",
        },
      );

      expect(
        reader.readGeneration,
      ).toHaveBeenNthCalledWith(
        2,
        {
          partitionKey:
            OWNER,
          sortKey:
            "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000002",
        },
      );

      expect(
        result,
      ).toEqual({
        outcome:
          "absence-verified",
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
        componentIds: [
          "primary_item",
          "derived_item",
        ],
        awsAccountId:
          "123456789012",
        awsRegion:
          "us-east-1",
        transactionRequestDigest:
          HASH_C,
        verifiedAt:
          VERIFIED_AT,
      });

      expect(
        Object.isFrozen(
          result,
        ),
      ).toBe(true);

      expect(
        Object.isFrozen(
          result.componentIds,
        ),
      ).toBe(true);
    });

    it("refuses a target whose exact planned generation remains present", async () => {
        const requested =
          request({
            targets: [
              target(
                "primary_item",
                "acct_000000000001",
              ),
            ],
          });

        const reader = {
          readGeneration:
            vi.fn()
              .mockResolvedValue({
                source:
                  "business-table-generation-read",
                consistency:
                  "strongly-consistent",
                partitionKey:
                  OWNER,
                sortKey:
                  "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000001",
                outcome:
                  "present",
                deletionGuardDigest:
                  HASH_C,
              }),
        } as BusinessItemGenerationReader;

        const verifier =
          new BusinessDeletionDynamoDbAbsenceVerifier(
            reader,
            () =>
              VERIFIED_AT,
          );

        await expect(
          verifier.verifyAbsent(
            requested,
          ),
        ).rejects.toThrow(
          "target primary_item planned generation remains present",
        );
    });

    it("treats a different current generation as proof that the planned generation is absent", async () => {
      const requested =
        request({
          targets: [
            target(
              "primary_item",
              "acct_000000000001",
            ),
          ],
        });

      const reader = {
        readGeneration:
          vi.fn()
            .mockResolvedValue({
              source:
                "business-table-generation-read",
              consistency:
                "strongly-consistent",
              partitionKey:
                OWNER,
              sortKey:
                "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000001",
              outcome:
                "present",
              deletionGuardDigest:
                HASH_A,
            }),
      } as BusinessItemGenerationReader;

      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          reader,
          () =>
            VERIFIED_AT,
        );

      await expect(
        verifier.verifyAbsent(
          requested,
        ),
      ).resolves.toMatchObject({
        outcome:
          "absence-verified",
        componentIds: [
          "primary_item",
        ],
      });
    });

    it("fails closed when a present legacy item has no generation", async () => {
      const requested =
        request({
          targets: [
            target(
              "primary_item",
              "acct_000000000001",
            ),
          ],
        });

      const reader = {
        readGeneration:
          vi.fn()
            .mockResolvedValue({
              source:
                "business-table-generation-read",
              consistency:
                "strongly-consistent",
              partitionKey:
                OWNER,
              sortKey:
                "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000001",
              outcome:
                "legacy-missing-generation",
            }),
      } as BusinessItemGenerationReader;

      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          reader,
          () =>
            VERIFIED_AT,
        );

      await expect(
        verifier.verifyAbsent(
          requested,
        ),
      ).rejects.toThrow(
        "target primary_item has no verifiable generation",
      );
    });

    it("fails closed on an untrusted or mismatched reader observation", async () => {
      const requested =
        request({
          targets: [
            target(
              "primary_item",
              "acct_000000000001",
            ),
          ],
        });

      const reader = {
        readGeneration:
          vi.fn()
            .mockResolvedValue({
              source:
                "caller-input",
              consistency:
                "strongly-consistent",
              outcome:
                "absent",
              partitionKey:
                OWNER,
              sortKey:
                "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000099",
            }),
      } as unknown as BusinessItemGenerationReader;

      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          reader,
          () =>
            VERIFIED_AT,
        );

      await expect(
        verifier.verifyAbsent(
          requested,
        ),
      ).rejects.toThrow(
        "generation observation is not trusted",
      );
    });

    it.each([
      {
        description:
          "operation",
        receipt: {
          operationId:
            "223e4567-e89b-42d3-a456-426614174000",
        },
      },
      {
        description:
          "manifest",
        receipt: {
          manifestIntegrityDigest:
            HASH_B,
        },
      },
      {
        description:
          "step",
        receipt: {
          stepId:
            "wrong-step",
        },
      },
      {
        description:
          "attempt",
        receipt: {
          attemptTokenDigest:
            HASH_A,
        },
      },
      {
        description:
          "component set",
        receipt: {
          componentIds: [
            "primary_item",
            "unexpected_item",
          ],
        },
      },
      {
        description:
          "AWS account",
        receipt: {
          awsAccountId:
            "999999999999",
        },
      },
      {
        description:
          "Region",
        receipt: {
          awsRegion:
            "us-west-2",
        },
      },
      {
        description:
          "transaction digest",
        receipt: {
          transactionRequestDigest:
            "not-a-digest",
        },
      },
      {
        description:
          "acceptance time",
        receipt: {
          acceptedAt:
            "2026-08-11T09:59:59Z",
        },
      },
    ])(
      "refuses a receipt with mismatched $description binding",
      async ({
        receipt,
      }) => {
        const valid =
          request();

        const verifier =
          new BusinessDeletionDynamoDbAbsenceVerifier(
            absentReader(),
            () =>
              VERIFIED_AT,
          );

        await expect(
          verifier.verifyAbsent({
            ...valid,
            transactionReceipt: {
              ...valid.transactionReceipt,
              ...receipt,
            },
          }),
        ).rejects.toThrow(
          /transaction receipt|acceptance time/,
        );
      },
    );

    it("refuses duplicate component identifiers and duplicate physical item keys", async () => {
      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          absentReader(),
          () =>
            VERIFIED_AT,
        );

      const duplicateIds = [
        target(
          "same_item",
          "acct_000000000001",
        ),
        target(
          "same_item",
          "acct_000000000002",
        ),
      ];

      await expect(
        verifier.verifyAbsent(
          request({
            targets:
              duplicateIds,
          }),
        ),
      ).rejects.toThrow(
        "component identifiers must be unique",
      );

      const duplicateKeys = [
        target(
          "first_item",
          "acct_000000000001",
        ),
        target(
          "second_item",
          "acct_000000000001",
        ),
      ];

      await expect(
        verifier.verifyAbsent(
          request({
            targets:
              duplicateKeys,
          }),
        ),
      ).rejects.toThrow(
        "same DynamoDB item cannot be verified twice",
      );
    });

    it("refuses mixed infrastructure boundaries and malformed generation preconditions", async () => {
      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          absentReader(),
          () =>
            VERIFIED_AT,
        );

      const mixed = [
        target(
          "first_item",
          "acct_000000000001",
        ),
        {
          ...target(
            "second_item",
            "acct_000000000002",
          ),
          awsRegion:
            "us-west-2",
        },
      ];

      await expect(
        verifier.verifyAbsent(
          request({
            targets:
              mixed,
          }),
        ),
      ).rejects.toThrow(
        "one AWS account and Region",
      );

      const malformed = {
        ...target(
          "first_item",
          "acct_000000000001",
        ),
        itemGenerationPrecondition: {
          ...target(
            "first_item",
            "acct_000000000001",
          ).itemGenerationPrecondition,
          generationAttributeName:
            "callerGeneration",
        },
      } as unknown as BusinessDeletionDynamoDbTarget;

      await expect(
        verifier.verifyAbsent(
          request({
            targets: [
              malformed,
            ],
          }),
        ),
      ).rejects.toThrow(
        "a target is invalid",
      );
    });

    it("refuses a noncanonical verification time", async () => {
      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          absentReader(),
          () =>
            "2026-08-11T10:00:00Z",
        );

      await expect(
        verifier.verifyAbsent(
          request(),
        ),
      ).rejects.toThrow(
        "absence verification time is invalid",
      );
    });

    it("refuses verification evidence that predates transaction acceptance", async () => {
      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          absentReader(),
          () =>
            "2026-08-11T09:59:58.999Z",
        );

      await expect(
        verifier.verifyAbsent(
          request(),
        ),
      ).rejects.toThrow(
        "absence verification time precedes transaction acceptance",
      );
    });

    it("propagates a reader failure without issuing verification evidence", async () => {
      const verifier =
        new BusinessDeletionDynamoDbAbsenceVerifier(
          {
            readGeneration:
              vi.fn()
                .mockRejectedValue(
                  new Error(
                    "DynamoDB unavailable",
                  ),
                ),
          },
          () =>
            VERIFIED_AT,
        );

      await expect(
        verifier.verifyAbsent(
          request(),
        ),
      ).rejects.toThrow(
        "DynamoDB unavailable",
      );
    });

    it("keeps the verifier free of AWS SDK commands, writes, runtime, handler, environment, and delete execution", () => {
      const source =
        readFileSync(
          new URL(
            "../src/business-deletion-dynamodb-absence-verifier.ts",
            import.meta.url,
          ),
          "utf8",
        );

      for (
        const forbidden of
        [
          "@aws-sdk/",
          "GetItemCommand",
          "QueryCommand",
          "ScanCommand",
          "PutItemCommand",
          "UpdateItemCommand",
          "DeleteItemCommand",
          "TransactWriteItemsCommand",
          "process.env",
          "BUSINESS_TABLE_NAME",
          "./handler",
          "business-runtime",
          ".execute(",
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
        "resolveBusinessItemGenerationForDeletion",
      );
    });
  },
);
