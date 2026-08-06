import {
  DynamoDBClient,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import type {
  AttributeValue,
} from "@aws-sdk/client-dynamodb";
import type {
  InvestorBusinessScopeDecision,
} from "./business-authorization.js";
import {
  INVESTMENT_ACCOUNT_ID_PATTERN,
  INVESTMENT_ACCOUNT_KIND,
  INVESTMENT_ACCOUNT_SCHEMA_VERSION,
  INVESTMENT_ACCOUNT_SORT_KEY_PREFIX,
  INVESTMENT_ACCOUNT_STATUSES,
  MAX_INVESTMENT_ACCOUNTS_PER_OWNER,
  type InvestmentAccountRecord,
  type InvestmentAccountStatus,
  type InvestmentAccountSummary,
} from "./business-records.js";

type Item = Record<string, AttributeValue>;

export type AllowedInvestorBusinessScope =
  Extract<
    InvestorBusinessScopeDecision,
    {
      status: "allow";
    }
  >;

export interface BusinessStoreConfig {
  region: string;
  tableName: string;
}

export class BusinessAuthorizationScopeError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "BusinessAuthorizationScopeError";
  }
}

export class BusinessDataIntegrityError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "BusinessDataIntegrityError";
  }
}

const OWNER_PARTITION_PATTERN =
  /^BUSINESS#OWNER#[A-Za-z0-9_-]{43}$/;

function authorizedOwnerPartitionKey(
  scope: AllowedInvestorBusinessScope,
): string {
  if (
    scope.status !== "allow" ||
    !OWNER_PARTITION_PATTERN.test(
      scope.ownerPartitionKey,
    )
  ) {
    throw new BusinessAuthorizationScopeError(
      "A valid server-derived investor ownership scope is required.",
    );
  }

  return scope.ownerPartitionKey;
}

function requiredString(
  item: Item,
  attributeName: string,
): string {
  const value =
    item[attributeName]?.S;

  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new BusinessDataIntegrityError(
      `Investment account ${attributeName} is invalid.`,
    );
  }

  return value;
}

function canonicalIsoTimestamp(
  item: Item,
  attributeName: string,
): string {
  const value =
    requiredString(
      item,
      attributeName,
    );

  const parsed =
    Date.parse(value);

  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value
  ) {
    throw new BusinessDataIntegrityError(
      `Investment account ${attributeName} is invalid.`,
    );
  }

  return value;
}

function isInvestmentAccountStatus(
  value: string,
): value is InvestmentAccountStatus {
  return (
    INVESTMENT_ACCOUNT_STATUSES as
      readonly string[]
  ).includes(value);
}

function parseInvestmentAccount(
  item: Item,
  expectedOwnerPartitionKey: string,
): InvestmentAccountSummary {
  const pk =
    requiredString(
      item,
      "pk",
    );

  if (pk !== expectedOwnerPartitionKey) {
    throw new BusinessDataIntegrityError(
      "Investment account ownership does not match the authorized scope.",
    );
  }

  const accountId =
    requiredString(
      item,
      "accountId",
    );

  if (
    !INVESTMENT_ACCOUNT_ID_PATTERN.test(
      accountId,
    )
  ) {
    throw new BusinessDataIntegrityError(
      "Investment account ID is invalid.",
    );
  }

  const sk =
    requiredString(
      item,
      "sk",
    );

  if (
    sk !==
    `${INVESTMENT_ACCOUNT_SORT_KEY_PREFIX}${accountId}`
  ) {
    throw new BusinessDataIntegrityError(
      "Investment account key does not match its ID.",
    );
  }

  if (
    requiredString(
      item,
      "kind",
    ) !== INVESTMENT_ACCOUNT_KIND
  ) {
    throw new BusinessDataIntegrityError(
      "Investment account kind is unsupported.",
    );
  }

  if (
    item.schemaVersion?.N !==
    String(
      INVESTMENT_ACCOUNT_SCHEMA_VERSION,
    )
  ) {
    throw new BusinessDataIntegrityError(
      "Investment account schema version is unsupported.",
    );
  }

  const status =
    requiredString(
      item,
      "status",
    );

  if (!isInvestmentAccountStatus(status)) {
    throw new BusinessDataIntegrityError(
      "Investment account status is unsupported.",
    );
  }

  const baseCurrency =
    requiredString(
      item,
      "baseCurrency",
    );

  if (baseCurrency !== "USD") {
    throw new BusinessDataIntegrityError(
      "Investment account base currency is unsupported.",
    );
  }

  const displayName =
    requiredString(
      item,
      "displayName",
    );

  if (
    displayName.length > 100 ||
    displayName.trim() !== displayName ||
    /[\u0000-\u001F\u007F]/.test(
      displayName,
    )
  ) {
    throw new BusinessDataIntegrityError(
      "Investment account display name is invalid.",
    );
  }

  const createdAt =
    canonicalIsoTimestamp(
      item,
      "createdAt",
    );

  const updatedAt =
    canonicalIsoTimestamp(
      item,
      "updatedAt",
    );

  if (createdAt > updatedAt) {
    throw new BusinessDataIntegrityError(
      "Investment account timestamps are inconsistent.",
    );
  }

  const record: InvestmentAccountRecord = {
    pk,
    sk,
    kind: INVESTMENT_ACCOUNT_KIND,
    schemaVersion:
      INVESTMENT_ACCOUNT_SCHEMA_VERSION,
    accountId,
    displayName,
    status,
    baseCurrency,
    createdAt,
    updatedAt,
  };

  return Object.freeze({
    id: record.accountId,
    displayName: record.displayName,
    status: record.status,
    baseCurrency: record.baseCurrency,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function cursorFingerprint(
  cursor: Item,
): string {
  return JSON.stringify(cursor);
}

export class BusinessStore {
  constructor(
    private readonly config:
      BusinessStoreConfig,
    private readonly client =
      new DynamoDBClient({
        region: config.region,
      }),
  ) {
    if (
      !config.region ||
      config.region.trim() !== config.region ||
      !config.tableName ||
      config.tableName.trim() !==
        config.tableName
    ) {
      throw new Error(
        "Business store configuration is invalid.",
      );
    }
  }

  async listInvestmentAccounts(
    scope: AllowedInvestorBusinessScope,
  ): Promise<
    readonly InvestmentAccountSummary[]
  > {
    const ownerPartitionKey =
      authorizedOwnerPartitionKey(scope);

    const accounts:
      InvestmentAccountSummary[] = [];

    let exclusiveStartKey:
      | Item
      | undefined;

    const observedCursors =
      new Set<string>();

    while (true) {
      const remaining =
        MAX_INVESTMENT_ACCOUNTS_PER_OWNER +
        1 -
        accounts.length;

      if (remaining <= 0) {
        throw new BusinessDataIntegrityError(
          "The investment account limit was exceeded.",
        );
      }

      const response =
        await this.client.send(
          new QueryCommand({
            TableName:
              this.config.tableName,
            KeyConditionExpression:
              "#pk = :owner AND begins_with(#sk, :accountPrefix)",
            ExpressionAttributeNames: {
              "#pk": "pk",
              "#sk": "sk",
              "#kind": "kind",
              "#schemaVersion":
                "schemaVersion",
              "#accountId":
                "accountId",
              "#displayName":
                "displayName",
              "#status": "status",
              "#baseCurrency":
                "baseCurrency",
              "#createdAt":
                "createdAt",
              "#updatedAt":
                "updatedAt",
            },
            ExpressionAttributeValues: {
              ":owner": {
                S: ownerPartitionKey,
              },
              ":accountPrefix": {
                S:
                  INVESTMENT_ACCOUNT_SORT_KEY_PREFIX,
              },
            },
            ProjectionExpression:
              "#pk, #sk, #kind, #schemaVersion, #accountId, #displayName, #status, #baseCurrency, #createdAt, #updatedAt",
            ConsistentRead: true,
            ScanIndexForward: true,
            Limit: remaining,
            ExclusiveStartKey:
              exclusiveStartKey,
          }),
        );

      for (
        const item of
        response.Items ?? []
      ) {
        accounts.push(
          parseInvestmentAccount(
            item,
            ownerPartitionKey,
          ),
        );

        if (
          accounts.length >
          MAX_INVESTMENT_ACCOUNTS_PER_OWNER
        ) {
          throw new BusinessDataIntegrityError(
            "The investment account limit was exceeded.",
          );
        }
      }

      const nextCursor =
        response.LastEvaluatedKey as
          | Item
          | undefined;

      if (!nextCursor) {
        break;
      }

      const fingerprint =
        cursorFingerprint(
          nextCursor,
        );

      if (
        observedCursors.has(
          fingerprint,
        )
      ) {
        throw new BusinessDataIntegrityError(
          "Investment account pagination did not advance.",
        );
      }

      observedCursors.add(
        fingerprint,
      );

      if (
        accounts.length >=
        MAX_INVESTMENT_ACCOUNTS_PER_OWNER
      ) {
        throw new BusinessDataIntegrityError(
          "The investment account limit was exceeded.",
        );
      }

      exclusiveStartKey =
        nextCursor;
    }

    return Object.freeze(
      accounts,
    );
  }
}