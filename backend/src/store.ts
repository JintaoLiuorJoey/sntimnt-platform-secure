import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import type { AuthConfig } from "./config.js";
import { sha256 } from "./security.js";
import type {
  OAuthTransactionRecord,
  RateLimitRecord,
  SessionRecord,
} from "./types.js";

type Item = Record<string, AttributeValue>;

const sessionPk = (sessionId: string) => `AUTH#SESSION#${sha256(sessionId)}`;
const oauthPk = (state: string) => `AUTH#OAUTH#${sha256(state)}`;

function recordItem(record: OAuthTransactionRecord | SessionRecord): Item {
  const item: Item = {
    pk: { S: record.pk },
    kind: { S: record.kind },
    ttl: { N: String(record.ttl) },
    data: { S: JSON.stringify(record) },
  };

  if (record.kind === "session") {
    item.absoluteExpiresAt = { N: String(record.absoluteExpiresAt) };
    item.idleExpiresAt = { N: String(record.idleExpiresAt) };
    item.adminMfaConfiguration = {
      S: record.adminMfaConfiguration,
    };
  }
  return item;
}

function parseRecord<T>(item: Item | undefined): T | null {
  const data = item?.data?.S;
  return data ? (JSON.parse(data) as T) : null;
}

export class AuthStore {
  constructor(
    private readonly config: AuthConfig,
    private readonly client = new DynamoDBClient({ region: config.region }),
  ) {}

  async putOAuthTransaction(
    state: string,
    record: Omit<OAuthTransactionRecord, "pk">,
  ): Promise<void> {
    const fullRecord = { ...record, pk: oauthPk(state) } satisfies OAuthTransactionRecord;
    await this.client.send(
      new PutItemCommand({
        TableName: this.config.tableName,
        Item: recordItem(fullRecord),
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  }

  async consumeOAuthTransaction(state: string): Promise<OAuthTransactionRecord | null> {
    const response = await this.client.send(
      new DeleteItemCommand({
        TableName: this.config.tableName,
        Key: { pk: { S: oauthPk(state) } },
        ReturnValues: "ALL_OLD",
      }),
    );
    return parseRecord<OAuthTransactionRecord>(response.Attributes as Item | undefined);
  }

  async putSession(sessionId: string, record: Omit<SessionRecord, "pk">): Promise<void> {
    const fullRecord = { ...record, pk: sessionPk(sessionId) } satisfies SessionRecord;
    await this.client.send(
      new PutItemCommand({
        TableName: this.config.tableName,
        Item: recordItem(fullRecord),
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const response = await this.client.send(
      new GetItemCommand({
        TableName: this.config.tableName,
        Key: { pk: { S: sessionPk(sessionId) } },
        ConsistentRead: true,
      }),
    );
    return parseRecord<SessionRecord>(response.Item as Item | undefined);
  }

  async touchSession(
    sessionId: string,
    record: SessionRecord,
    now: number,
    idleExpiresAt: number,
  ): Promise<SessionRecord | null> {
    const nextRecord: SessionRecord = {
      ...record,
      lastSeenAt: now,
      idleExpiresAt,
    };

    try {
      const response = await this.client.send(
        new UpdateItemCommand({
          TableName: this.config.tableName,
          Key: { pk: { S: sessionPk(sessionId) } },
          UpdateExpression:
            "SET lastSeenAt = :now, idleExpiresAt = :idle, #data = :data",
          ConditionExpression:
            "#kind = :sessionKind AND absoluteExpiresAt > :now AND idleExpiresAt > :now",
          ExpressionAttributeNames: { "#kind": "kind", "#data": "data" },
          ExpressionAttributeValues: {
            ":now": { N: String(now) },
            ":idle": { N: String(idleExpiresAt) },
            ":sessionKind": { S: "session" },
            ":data": { S: JSON.stringify(nextRecord) },
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      return parseRecord<SessionRecord>(response.Attributes as Item | undefined);
    } catch (error) {
      if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
        return null;
      }
      throw error;
    }
  }

  async markAdminMfaConfigured(
    sessionId: string,
    record: SessionRecord,
    now: number,
  ): Promise<SessionRecord | null> {
    if (
      !record.user.roles.includes("admin") ||
      record.adminMfaConfiguration !==
        "enrollment-required"
    ) {
      return null;
    }

    const nextRecord: SessionRecord = {
      ...record,
      adminMfaConfiguration: "configured",
    };

    try {
      const response = await this.client.send(
        new UpdateItemCommand({
          TableName: this.config.tableName,
          Key: {
            pk: {
              S: sessionPk(sessionId),
            },
          },
          UpdateExpression:
            "SET #adminMfaConfiguration = :configured, #data = :data",
          ConditionExpression:
            "#kind = :sessionKind AND absoluteExpiresAt > :now AND idleExpiresAt > :now AND (attribute_not_exists(#adminMfaConfiguration) OR #adminMfaConfiguration = :enrollmentRequired) AND #data = :expectedData",
          ExpressionAttributeNames: {
            "#kind": "kind",
            "#data": "data",
            "#adminMfaConfiguration":
              "adminMfaConfiguration",
          },
          ExpressionAttributeValues: {
            ":sessionKind": {
              S: "session",
            },
            ":now": {
              N: String(now),
            },
            ":enrollmentRequired": {
              S: "enrollment-required",
            },
            ":configured": {
              S: "configured",
            },
            ":expectedData": {
              S: JSON.stringify(record),
            },
            ":data": {
              S: JSON.stringify(nextRecord),
            },
          },
          ReturnValues: "ALL_NEW",
        }),
      );

      return parseRecord<SessionRecord>(
        response.Attributes as
          | Item
          | undefined,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.name ===
          "ConditionalCheckFailedException"
      ) {
        return null;
      }

      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<SessionRecord | null> {
    const response = await this.client.send(
      new DeleteItemCommand({
        TableName: this.config.tableName,
        Key: { pk: { S: sessionPk(sessionId) } },
        ReturnValues: "ALL_OLD",
      }),
    );
    return parseRecord<SessionRecord>(response.Attributes as Item | undefined);
  }

  async rotateSession(
    oldSessionId: string,
    newSessionId: string,
    newRecord: Omit<SessionRecord, "pk">,
  ): Promise<void> {
    const fullRecord = { ...newRecord, pk: sessionPk(newSessionId) } satisfies SessionRecord;
    await this.client.send(
      new TransactWriteItemsCommand({
        TransactItems: [
          {
            Delete: {
              TableName: this.config.tableName,
              Key: { pk: { S: sessionPk(oldSessionId) } },
              ConditionExpression: "attribute_exists(pk)",
            },
          },
          {
            Put: {
              TableName: this.config.tableName,
              Item: recordItem(fullRecord),
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
        ],
      }),
    );
  }

  async incrementRateLimit(
    scope: string,
    subject: string,
    now: number,
    windowSeconds: number,
  ): Promise<number> {
    const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
    const pk = `AUTH#RATE#${scope}#${sha256(subject)}#${windowStart}`;
    const ttl = windowStart + windowSeconds + 60;

    const response = await this.client.send(
      new UpdateItemCommand({
        TableName: this.config.tableName,
        Key: { pk: { S: pk } },
        UpdateExpression:
          "SET #kind = if_not_exists(#kind, :kind), #ttl = if_not_exists(#ttl, :ttl) ADD attemptCount :one",
        ExpressionAttributeNames: { "#kind": "kind", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":kind": { S: "rate" },
          ":ttl": { N: String(ttl) },
          ":one": { N: "1" },
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    const count = (response.Attributes as Item | undefined)?.attemptCount?.N;
    return count ? Number(count) : 1;
  }
}
