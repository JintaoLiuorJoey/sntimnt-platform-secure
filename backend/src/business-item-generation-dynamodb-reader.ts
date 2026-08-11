import {
  DynamoDBClient,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import type {
  AttributeValue,
} from "@aws-sdk/client-dynamodb";

import type {
  BusinessItemGenerationKey,
  BusinessItemGenerationReadResult,
  BusinessItemGenerationReader,
} from "./business-item-generation.js";

type Item =
  Record<string, AttributeValue>;

export interface BusinessItemGenerationDynamoDbReaderConfig {
  readonly region:
    string;
  readonly tableName:
    string;
}

export class BusinessItemGenerationReadIntegrityError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "BusinessItemGenerationReadIntegrityError";
  }
}

const AWS_REGION_PATTERN =
  /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/;

const DYNAMODB_TABLE_NAME_PATTERN =
  /^[A-Za-z0-9_.-]{3,255}$/;

const KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9#:_./@+-]{0,1023}$/;

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

function canonicalConfig(
  config:
    Readonly<BusinessItemGenerationDynamoDbReaderConfig>,
): Readonly<BusinessItemGenerationDynamoDbReaderConfig> {
  if (
    !config ||
    !AWS_REGION_PATTERN.test(
      config.region,
    ) ||
    !DYNAMODB_TABLE_NAME_PATTERN.test(
      config.tableName,
    )
  ) {
    throw new Error(
      "Business item generation reader configuration is invalid.",
    );
  }

  return Object.freeze({
    region:
      config.region,
    tableName:
      config.tableName,
  });
}

function canonicalKey(
  key:
    Readonly<BusinessItemGenerationKey>,
): Readonly<BusinessItemGenerationKey> {
  if (
    !key ||
    !KEY_PATTERN.test(
      key.partitionKey,
    ) ||
    !KEY_PATTERN.test(
      key.sortKey,
    )
  ) {
    throw new Error(
      "Business item generation read key is invalid.",
    );
  }

  return Object.freeze({
    partitionKey:
      key.partitionKey,
    sortKey:
      key.sortKey,
  });
}

function exactStringAttribute(
  item:
    Item,
  attributeName:
    string,
): string {
  const attribute =
    item[attributeName];

  if (
    !attribute ||
    typeof attribute.S !==
      "string" ||
    attribute.S.length === 0
  ) {
    throw new BusinessItemGenerationReadIntegrityError(
      `Business item generation ${attributeName} is invalid.`,
    );
  }

  return attribute.S;
}

function assertExactReturnedKey(
  item:
    Item,
  requestedKey:
    Readonly<BusinessItemGenerationKey>,
): void {
  if (
    exactStringAttribute(
      item,
      "pk",
    ) !== requestedKey.partitionKey ||
    exactStringAttribute(
      item,
      "sk",
    ) !== requestedKey.sortKey
  ) {
    throw new BusinessItemGenerationReadIntegrityError(
      "Business item generation read returned a different item.",
    );
  }
}

export class BusinessItemGenerationDynamoDbReader
  implements BusinessItemGenerationReader {
  private readonly config:
    Readonly<BusinessItemGenerationDynamoDbReaderConfig>;

  constructor(
    config:
      Readonly<BusinessItemGenerationDynamoDbReaderConfig>,
    private readonly client =
      new DynamoDBClient({
        region:
          config.region,
      }),
  ) {
    this.config =
      canonicalConfig(
        config,
      );
  }

  async readGeneration(
    requestedKey:
      Readonly<BusinessItemGenerationKey>,
  ): Promise<
    Readonly<BusinessItemGenerationReadResult>
  > {
    const key =
      canonicalKey(
        requestedKey,
      );

    const response =
      await this.client.send(
        new GetItemCommand({
          TableName:
            this.config.tableName,
          Key: {
            pk: {
              S:
                key.partitionKey,
            },
            sk: {
              S:
                key.sortKey,
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
        }),
      );

    if (
      response.Item ===
      undefined
    ) {
      return Object.freeze({
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
      });
    }

    const item =
      response.Item as Item;

    if (
      !item ||
      typeof item !==
        "object" ||
      Array.isArray(
        item,
      )
    ) {
      throw new BusinessItemGenerationReadIntegrityError(
        "Business item generation read returned an invalid item.",
      );
    }

    assertExactReturnedKey(
      item,
      key,
    );

    if (
      !Object.prototype.hasOwnProperty.call(
        item,
        "deletionGuardDigest",
      )
    ) {
      return Object.freeze({
        source:
          "business-table-generation-read" as const,
        consistency:
          "strongly-consistent" as const,
        outcome:
          "legacy-missing-generation" as const,
        partitionKey:
          key.partitionKey,
        sortKey:
          key.sortKey,
      });
    }

    const deletionGuardDigest =
      exactStringAttribute(
        item,
        "deletionGuardDigest",
      );

    if (
      !SHA256_PATTERN.test(
        deletionGuardDigest,
      )
    ) {
      throw new BusinessItemGenerationReadIntegrityError(
        "Business item generation deletionGuardDigest is invalid.",
      );
    }

    return Object.freeze({
      source:
        "business-table-generation-read" as const,
      consistency:
        "strongly-consistent" as const,
      outcome:
        "present" as const,
      partitionKey:
        key.partitionKey,
      sortKey:
        key.sortKey,
      deletionGuardDigest,
    });
  }
}
