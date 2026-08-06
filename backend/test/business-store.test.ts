import {
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import type {
  AttributeValue,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  investorBusinessScope,
} from "../src/business-authorization.js";
import {
  INVESTMENT_ACCOUNT_SORT_KEY_PREFIX,
} from "../src/business-records.js";
import {
  BusinessAuthorizationScopeError,
  BusinessDataIntegrityError,
  BusinessStore,
  type AllowedInvestorBusinessScope,
  type BusinessStoreConfig,
} from "../src/business-store.js";
import type {
  SessionRecord,
} from "../src/types.js";

type Item =
  Record<string, AttributeValue>;

const config: BusinessStoreConfig = {
  region: "us-east-1",
  tableName: "business-table",
};

function session(): SessionRecord {
  return {
    pk: "AUTH#SESSION#test",
    kind: "session",
    user: {
      id: "mutable-investor-id",
      email: "investor@example.com",
      displayName: "Verified Investor",
      roles: ["investor"],
    },
    adminMfaConfiguration:
      "not-required",
    refreshTokenCiphertext:
      "refresh-ciphertext",
    accessTokenCiphertext:
      "access-ciphertext",
    csrfHash: "csrf-hash",
    subject:
      "canonical-cognito-subject",
    authenticatedAt: 900,
    createdAt: 900,
    lastSeenAt: 1_000,
    absoluteExpiresAt: 2_000,
    idleExpiresAt: 1_500,
    tokenExpiresAt: 1_300,
    ttl: 2_000,
  };
}

function allowedScope():
  AllowedInvestorBusinessScope {
  const decision =
    investorBusinessScope(
      session(),
    );

  if (decision.status !== "allow") {
    throw new Error(
      "Expected an allowed investor scope.",
    );
  }

  return decision;
}

const scope =
  allowedScope();

function validItem(
  accountId =
    "acct_000000000001",
  overrides: Item = {},
): Item {
  return {
    pk: {
      S: scope.ownerPartitionKey,
    },
    sk: {
      S:
        `${INVESTMENT_ACCOUNT_SORT_KEY_PREFIX}${accountId}`,
    },
    kind: {
      S: "investment-account",
    },
    schemaVersion: {
      N: "1",
    },
    accountId: {
      S: accountId,
    },
    displayName: {
      S: "Primary Investment Account",
    },
    status: {
      S: "active",
    },
    baseCurrency: {
      S: "USD",
    },
    createdAt: {
      S:
        "2026-08-05T20:00:00.000Z",
    },
    updatedAt: {
      S:
        "2026-08-05T20:30:00.000Z",
    },
    ...overrides,
  };
}

function createStore(
  send: unknown,
): BusinessStore {
  return new BusinessStore(
    config,
    {
      send,
    } as unknown as DynamoDBClient,
  );
}

describe(
  "owner-scoped investment account storage",
  () => {
    it("rejects a malformed or caller-forged owner scope before querying", async () => {
      const send =
        vi.fn();

      const store =
        createStore(send);

      await expect(
        store.listInvestmentAccounts(
          {
            status: "allow",
            ownerPartitionKey:
              "BUSINESS#OWNER#raw-subject",
          } as AllowedInvestorBusinessScope,
        ),
      ).rejects.toBeInstanceOf(
        BusinessAuthorizationScopeError,
      );

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it("queries only the authorized owner partition and investment-account key prefix", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({
            Items: [],
          });

      const store =
        createStore(send);

      await store.listInvestmentAccounts(
        scope,
      );

      expect(
        send,
      ).toHaveBeenCalledTimes(1);

      const command =
        send.mock.calls[0]?.[0];

      expect(
        command,
      ).toBeInstanceOf(
        QueryCommand,
      );

      if (
        !(command instanceof QueryCommand)
      ) {
        throw new Error(
          "Expected QueryCommand.",
        );
      }

      expect(
        command.input.TableName,
      ).toBe(
        "business-table",
      );

      expect(
        command.input.KeyConditionExpression,
      ).toBe(
        "#pk = :owner AND begins_with(#sk, :accountPrefix)",
      );

      expect(
        command.input
          .ExpressionAttributeValues
          ?.[":owner"],
      ).toEqual({
        S:
          scope.ownerPartitionKey,
      });

      expect(
        command.input
          .ExpressionAttributeValues
          ?.[":accountPrefix"],
      ).toEqual({
        S:
          INVESTMENT_ACCOUNT_SORT_KEY_PREFIX,
      });

      expect(
        command.input.ConsistentRead,
      ).toBe(true);

      expect(
        command.input.ScanIndexForward,
      ).toBe(true);

      expect(
        command.input.Limit,
      ).toBe(101);

      expect(
        command.input.FilterExpression,
      ).toBeUndefined();

      expect(
        command.input.ExclusiveStartKey,
      ).toBeUndefined();
    });

    it("returns only validated public account summaries without persistence keys", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({
            Items: [
              validItem(),
            ],
          });

      const store =
        createStore(send);

      const accounts =
        await store
          .listInvestmentAccounts(
            scope,
          );

      expect(accounts).toEqual([
        {
          id:
            "acct_000000000001",
          displayName:
            "Primary Investment Account",
          status: "active",
          baseCurrency: "USD",
          createdAt:
            "2026-08-05T20:00:00.000Z",
          updatedAt:
            "2026-08-05T20:30:00.000Z",
        },
      ]);

      expect(
        accounts[0],
      ).not.toHaveProperty(
        "pk",
      );

      expect(
        accounts[0],
      ).not.toHaveProperty(
        "sk",
      );

      expect(
        Object.isFrozen(
          accounts,
        ),
      ).toBe(true);

      expect(
        Object.isFrozen(
          accounts[0],
        ),
      ).toBe(true);
    });

    it("continues an owner-scoped query with the DynamoDB pagination cursor", async () => {
      const cursor: Item = {
        pk: {
          S:
            scope.ownerPartitionKey,
        },
        sk: {
          S:
            `${INVESTMENT_ACCOUNT_SORT_KEY_PREFIX}acct_000000000001`,
        },
      };

      const send =
        vi.fn()
          .mockResolvedValueOnce({
            Items: [
              validItem(
                "acct_000000000001",
              ),
            ],
            LastEvaluatedKey:
              cursor,
          })
          .mockResolvedValueOnce({
            Items: [
              validItem(
                "acct_000000000002",
              ),
            ],
          });

      const store =
        createStore(send);

      const accounts =
        await store
          .listInvestmentAccounts(
            scope,
          );

      expect(
        accounts.map(
          (account) =>
            account.id,
        ),
      ).toEqual([
        "acct_000000000001",
        "acct_000000000002",
      ]);

      expect(
        send,
      ).toHaveBeenCalledTimes(2);

      const secondCommand =
        send.mock.calls[1]?.[0];

      expect(
        secondCommand,
      ).toBeInstanceOf(
        QueryCommand,
      );

      if (
        !(
          secondCommand instanceof
          QueryCommand
        )
      ) {
        throw new Error(
          "Expected QueryCommand.",
        );
      }

      expect(
        secondCommand.input
          .ExclusiveStartKey,
      ).toEqual(cursor);

      expect(
        secondCommand.input.Limit,
      ).toBe(100);
    });

    it("fails closed when a pagination cursor repeats", async () => {
      const cursor: Item = {
        pk: {
          S:
            scope.ownerPartitionKey,
        },
        sk: {
          S:
            `${INVESTMENT_ACCOUNT_SORT_KEY_PREFIX}acct_000000000001`,
        },
      };

      const send =
        vi.fn()
          .mockResolvedValueOnce({
            Items: [],
            LastEvaluatedKey:
              cursor,
          })
          .mockResolvedValueOnce({
            Items: [],
            LastEvaluatedKey:
              cursor,
          });

      const store =
        createStore(send);

      await expect(
        store.listInvestmentAccounts(
          scope,
        ),
      ).rejects.toThrow(
        "pagination did not advance",
      );

      expect(
        send,
      ).toHaveBeenCalledTimes(2);
    });

    it("rejects a record whose stored owner differs from the authorized owner", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({
            Items: [
              validItem(
                undefined,
                {
                  pk: {
                    S:
                      "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
                  },
                },
              ),
            ],
          });

      const store =
        createStore(send);

      await expect(
        store.listInvestmentAccounts(
          scope,
        ),
      ).rejects.toBeInstanceOf(
        BusinessDataIntegrityError,
      );
    });

    const malformedCases:
      Array<
        [
          string,
          Item,
        ]
      > = [
        [
          "an unsupported record kind",
          {
            kind: {
              S: "session",
            },
          },
        ],
        [
          "an unsupported schema version",
          {
            schemaVersion: {
              N: "2",
            },
          },
        ],
        [
          "a sort key that does not match the account ID",
          {
            sk: {
              S:
                `${INVESTMENT_ACCOUNT_SORT_KEY_PREFIX}acct_000000000099`,
            },
          },
        ],
        [
          "an unsupported account status",
          {
            status: {
              S: "deleted",
            },
          },
        ],
        [
          "an unsupported base currency",
          {
            baseCurrency: {
              S: "EUR",
            },
          },
        ],
        [
          "a noncanonical timestamp",
          {
            updatedAt: {
              S:
                "2026-08-05T20:30:00+00:00",
            },
          },
        ],
        [
          "a blank display name",
          {
            displayName: {
              S: "",
            },
          },
        ],
      ];

    it.each(
      malformedCases,
    )(
      "rejects %s",
      async (
        _description,
        overrides,
      ) => {
        const send =
          vi.fn()
            .mockResolvedValue({
              Items: [
                validItem(
                  undefined,
                  overrides,
                ),
              ],
            });

        const store =
          createStore(send);

        await expect(
          store.listInvestmentAccounts(
            scope,
          ),
        ).rejects.toBeInstanceOf(
          BusinessDataIntegrityError,
        );
      },
    );

    it("fails closed when the per-owner investment-account maximum is exceeded", async () => {
      const items =
        Array.from(
          {
            length: 101,
          },
          (
            _value,
            index,
          ) =>
            validItem(
              `acct_${String(
                index,
              ).padStart(
                12,
                "0",
              )}`,
            ),
        );

      const send =
        vi.fn()
          .mockResolvedValue({
            Items: items,
          });

      const store =
        createStore(send);

      await expect(
        store.listInvestmentAccounts(
          scope,
        ),
      ).rejects.toThrow(
        "account limit was exceeded",
      );
    });

    it("propagates an unexpected DynamoDB failure", async () => {
      const send =
        vi.fn()
          .mockRejectedValue(
            new Error(
              "DynamoDB unavailable",
            ),
          );

      const store =
        createStore(send);

      await expect(
        store.listInvestmentAccounts(
          scope,
        ),
      ).rejects.toThrow(
        "DynamoDB unavailable",
      );
    });
  },
);