import {
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import type {
  AttributeValue,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
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
  BusinessItemGenerationDynamoDbReader,
  BusinessItemGenerationReadIntegrityError,
} from "../src/business-item-generation-dynamodb-reader.js";

type Item =
  Record<string, AttributeValue>;

const PARTITION_KEY =
  "BUSINESS#OWNER#XKkzH4i6IJ7oBTSPcL88KKr-qWsX35sJjZsR3Q7lsCY";

const SORT_KEY =
  "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000001";

const GENERATION =
  "a".repeat(64);

function createReader(
  send:
    unknown,
): BusinessItemGenerationDynamoDbReader {
  return new BusinessItemGenerationDynamoDbReader(
    {
      region:
        "us-east-1",
      tableName:
        "business-table",
    },
    {
      send,
    } as unknown as DynamoDBClient,
  );
}

function key() {
  return {
    partitionKey:
      PARTITION_KEY,
    sortKey:
      SORT_KEY,
  };
}

function projectedItem(
  overrides:
    Item = {},
): Item {
  return {
    pk: {
      S:
        PARTITION_KEY,
    },
    sk: {
      S:
        SORT_KEY,
    },
    deletionGuardDigest: {
      S:
        GENERATION,
    },
    ...overrides,
  };
}

describe(
  "business item generation DynamoDB reader",
  () => {
    it("uses an exact strongly consistent GetItem with a generation-only projection", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({
            Item:
              projectedItem(),
          });

      const reader =
        createReader(
          send,
        );

      await reader.readGeneration(
        key(),
      );

      expect(
        send,
      ).toHaveBeenCalledTimes(1);

      const command =
        send.mock.calls[0]?.[0];

      expect(
        command,
      ).toBeInstanceOf(
        GetItemCommand,
      );

      if (
        !(
          command instanceof
          GetItemCommand
        )
      ) {
        throw new Error(
          "Expected GetItemCommand.",
        );
      }

      expect(
        command.input,
      ).toEqual({
        TableName:
          "business-table",
        Key: {
          pk: {
            S:
              PARTITION_KEY,
          },
          sk: {
            S:
              SORT_KEY,
          },
        },
        ProjectionExpression:
          "#pk, #sk, #generation",
        ExpressionAttributeNames: {
          "#pk": "pk",
          "#sk": "sk",
          "#generation":
            "deletionGuardDigest",
        },
        ConsistentRead: true,
      });
    });

    it("returns an immutable trusted-shape observation for an exact generation", async () => {
      const reader =
        createReader(
          vi.fn()
            .mockResolvedValue({
              Item:
                projectedItem(),
            }),
        );

      const result =
        await reader.readGeneration(
          key(),
        );

      expect(
        result,
      ).toEqual({
        source:
          "business-table-generation-read",
        consistency:
          "strongly-consistent",
        outcome:
          "present",
        partitionKey:
          PARTITION_KEY,
        sortKey:
          SORT_KEY,
        deletionGuardDigest:
          GENERATION,
      });

      expect(
        Object.isFrozen(
          result,
        ),
      ).toBe(true);
    });

    it("distinguishes an absent item from a legacy item without a generation", async () => {
      const absentReader =
        createReader(
          vi.fn()
            .mockResolvedValue({}),
        );

      await expect(
        absentReader.readGeneration(
          key(),
        ),
      ).resolves.toEqual({
        source:
          "business-table-generation-read",
        consistency:
          "strongly-consistent",
        outcome:
          "absent",
        partitionKey:
          PARTITION_KEY,
        sortKey:
          SORT_KEY,
      });

      const legacy =
        projectedItem();

      delete legacy
        .deletionGuardDigest;

      const legacyReader =
        createReader(
          vi.fn()
            .mockResolvedValue({
              Item:
                legacy,
            }),
        );

      await expect(
        legacyReader.readGeneration(
          key(),
        ),
      ).resolves.toEqual({
        source:
          "business-table-generation-read",
        consistency:
          "strongly-consistent",
        outcome:
          "legacy-missing-generation",
        partitionKey:
          PARTITION_KEY,
        sortKey:
          SORT_KEY,
      });
    });

    it("rejects malformed keys before sending a DynamoDB request", async () => {
      const send =
        vi.fn();

      const reader =
        createReader(
          send,
        );

      await expect(
        reader.readGeneration({
          partitionKey:
            ` ${PARTITION_KEY}`,
          sortKey:
            SORT_KEY,
        }),
      ).rejects.toThrow(
        "Business item generation read key is invalid.",
      );

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it.each([
      {
        description:
          "a different partition key",
        item:
          projectedItem({
            pk: {
              S:
                "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            },
          }),
        message:
          "returned a different item",
      },
      {
        description:
          "a different sort key",
        item:
          projectedItem({
            sk: {
              S:
                "BUSINESS#INVESTMENT_ACCOUNT#acct_000000000002",
            },
          }),
        message:
          "returned a different item",
      },
      {
        description:
          "a non-string generation",
        item:
          projectedItem({
            deletionGuardDigest: {
              N: "1",
            },
          }),
        message:
          "deletionGuardDigest is invalid",
      },
      {
        description:
          "an uppercase generation",
        item:
          projectedItem({
            deletionGuardDigest: {
              S:
                "A".repeat(64),
            },
          }),
        message:
          "deletionGuardDigest is invalid",
      },
    ])(
      "fails closed on $description",
      async ({
        item,
        message,
      }) => {
        const reader =
          createReader(
            vi.fn()
              .mockResolvedValue({
                Item:
                  item,
              }),
          );

        await expect(
          reader.readGeneration(
            key(),
          ),
        ).rejects.toThrow(
          message,
        );
      },
    );

    it("uses a dedicated integrity error for malformed projected items", async () => {
      const reader =
        createReader(
          vi.fn()
            .mockResolvedValue({
              Item: {
                pk: {
                  S:
                    PARTITION_KEY,
                },
              },
            }),
        );

      await expect(
        reader.readGeneration(
          key(),
        ),
      ).rejects.toBeInstanceOf(
        BusinessItemGenerationReadIntegrityError,
      );
    });

    it("rejects malformed configuration without sending a request", () => {
      const send =
        vi.fn();

      for (
        const config of
        [
          {
            region:
              " us-east-1",
            tableName:
              "business-table",
          },
          {
            region:
              "us-east-1",
            tableName:
              "bad table",
          },
        ]
      ) {
        expect(
          () =>
            new BusinessItemGenerationDynamoDbReader(
              config,
              {
                send,
              } as unknown as DynamoDBClient,
            ),
        ).toThrow(
          "Business item generation reader configuration is invalid.",
        );
      }

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it("propagates an unexpected DynamoDB failure", async () => {
      const reader =
        createReader(
          vi.fn()
            .mockRejectedValue(
              new Error(
                "DynamoDB unavailable",
              ),
            ),
        );

      await expect(
        reader.readGeneration(
          key(),
        ),
      ).rejects.toThrow(
        "DynamoDB unavailable",
      );
    });

    it("keeps the reader free of scans, writes, migration, runtime, handler, environment, and deletion execution", () => {
      const source =
        readFileSync(
          new URL(
            "../src/business-item-generation-dynamodb-reader.ts",
            import.meta.url,
          ),
          "utf8",
        );

      expect(
        source,
      ).toContain(
        "GetItemCommand",
      );

      expect(
        source,
      ).toContain(
        "ConsistentRead: true",
      );

      for (
        const forbidden of
        [
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
          "LegacyMigration",
          "business-deletion-executor",
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
