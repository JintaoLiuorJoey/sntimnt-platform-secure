import {
  PutItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import type {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type {
  AuthConfig,
} from "../src/config.js";
import {
  AuthStore,
} from "../src/store.js";
import type {
  SessionRecord,
} from "../src/types.js";

const NOW = 2_000_000_000;

const config = {
  region: "us-east-1",
  tableName: "auth-table",
} as AuthConfig;

function storedSession(
  overrides: Partial<
    Omit<SessionRecord, "pk">
  > = {},
): Omit<SessionRecord, "pk"> {
  return {
    kind: "session",
    user: {
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Administrator",
      roles: ["admin"],
    },
    adminMfaConfiguration:
      "enrollment-required",
    refreshTokenCiphertext:
      "refresh-ciphertext",
    accessTokenCiphertext:
      "access-ciphertext",
    csrfHash: "csrf-hash",
    subject: "admin-1",
    authenticatedAt: NOW - 100,
    createdAt: NOW - 100,
    lastSeenAt: NOW - 100,
    absoluteExpiresAt: NOW + 3_600,
    idleExpiresAt: NOW + 1_800,
    tokenExpiresAt: NOW + 600,
    ttl: NOW + 3_600,
    ...overrides,
  };
}

function loadedSession(
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    pk: "AUTH#SESSION#stored",
    ...storedSession(),
    ...overrides,
  };
}

function createStore(
  send: unknown,
): AuthStore {
  return new AuthStore(
    config,
    {
      send,
    } as unknown as DynamoDBClient,
  );
}

describe(
  "administrator MFA session persistence",
  () => {
    it("persists the internal MFA state as both indexed data and serialized session data", async () => {
      const send = vi.fn()
        .mockResolvedValue({});

      const store = createStore(send);
      const record = storedSession();

      await store.putSession(
        "session-id",
        record,
      );

      expect(send).toHaveBeenCalledTimes(1);

      const command =
        send.mock.calls[0]?.[0];

      expect(command).toBeInstanceOf(
        PutItemCommand,
      );

      if (
        !(command instanceof PutItemCommand)
      ) {
        throw new Error(
          "Expected PutItemCommand.",
        );
      }

      expect(
        command.input.Item
          ?.adminMfaConfiguration,
      ).toEqual({
        S: "enrollment-required",
      });

      const serialized =
        command.input.Item?.data?.S;

      expect(serialized).toBeDefined();

      const stored = JSON.parse(
        serialized ?? "{}",
      ) as SessionRecord;

      expect(
        stored.adminMfaConfiguration,
      ).toBe("enrollment-required");
    });

    it("conditionally upgrades an enrollment-required administrator session", async () => {
      const record = loadedSession();

      const configured: SessionRecord = {
        ...record,
        adminMfaConfiguration:
          "configured",
      };

      const send = vi.fn()
        .mockResolvedValue({
          Attributes: {
            data: {
              S: JSON.stringify(
                configured,
              ),
            },
          },
        });

      const store = createStore(send);

      const result =
        await store.markAdminMfaConfigured(
          "session-id",
          record,
          NOW,
        );

      expect(result).toEqual(configured);
      expect(
        record.adminMfaConfiguration,
      ).toBe("enrollment-required");

      expect(send).toHaveBeenCalledTimes(1);

      const command =
        send.mock.calls[0]?.[0];

      expect(command).toBeInstanceOf(
        UpdateItemCommand,
      );

      if (
        !(command instanceof UpdateItemCommand)
      ) {
        throw new Error(
          "Expected UpdateItemCommand.",
        );
      }

      expect(
        command.input.UpdateExpression,
      ).toBe(
        "SET #adminMfaConfiguration = :configured, #data = :data",
      );

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "absoluteExpiresAt > :now",
      );

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "idleExpiresAt > :now",
      );

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "attribute_not_exists(#adminMfaConfiguration)",
      );

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "#adminMfaConfiguration = :enrollmentRequired",
      );

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "#data = :expectedData",
      );

      expect(
        command.input
          .ExpressionAttributeValues
          ?.[":expectedData"],
      ).toEqual({
        S: JSON.stringify(record),
      });

      expect(
        command.input
          .ExpressionAttributeValues
          ?.[":data"],
      ).toEqual({
        S: JSON.stringify(configured),
      });

      expect(
        command.input
          .ExpressionAttributeValues
          ?.[":configured"],
      ).toEqual({
        S: "configured",
      });

      expect(
        command.input.ReturnValues,
      ).toBe("ALL_NEW");
    });

    it("does not write a non-administrator MFA state", async () => {
      const send = vi.fn();
      const store = createStore(send);

      const record = loadedSession({
        user: {
          id: "investor-1",
          email:
            "investor@example.com",
          displayName: "Investor",
          roles: ["investor"],
        },
        adminMfaConfiguration:
          "not-required",
      });

      await expect(
        store.markAdminMfaConfigured(
          "session-id",
          record,
          NOW,
        ),
      ).resolves.toBeNull();

      expect(send).not.toHaveBeenCalled();
    });

    it("does not rewrite an already configured administrator session", async () => {
      const send = vi.fn();
      const store = createStore(send);

      const record = loadedSession({
        adminMfaConfiguration:
          "configured",
      });

      await expect(
        store.markAdminMfaConfigured(
          "session-id",
          record,
          NOW,
        ),
      ).resolves.toBeNull();

      expect(send).not.toHaveBeenCalled();
    });

    it("returns null when the conditional session update loses its race", async () => {
      const conditionalError =
        new Error(
          "The session changed.",
        );

      conditionalError.name =
        "ConditionalCheckFailedException";

      const send = vi.fn()
        .mockRejectedValue(
          conditionalError,
        );

      const store = createStore(send);

      await expect(
        store.markAdminMfaConfigured(
          "session-id",
          loadedSession(),
          NOW,
        ),
      ).resolves.toBeNull();

      expect(send).toHaveBeenCalledTimes(1);
    });

    it("propagates an unexpected persistence failure", async () => {
      const send = vi.fn()
        .mockRejectedValue(
          new Error(
            "DynamoDB unavailable",
          ),
        );

      const store = createStore(send);

      await expect(
        store.markAdminMfaConfigured(
          "session-id",
          loadedSession(),
          NOW,
        ),
      ).rejects.toThrow(
        "DynamoDB unavailable",
      );

      expect(send).toHaveBeenCalledTimes(1);
    });
  },
);
