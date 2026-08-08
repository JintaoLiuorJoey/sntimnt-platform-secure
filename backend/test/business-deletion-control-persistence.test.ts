import {
  GetItemCommand,
  PutItemCommand,
  TransactWriteItemsCommand,
  UpdateItemCommand,
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
  BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
  BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
  type BusinessDeletionControlIdempotencyClaim,
  type BusinessDeletionControlLegalHoldRecord,
  type BusinessDeletionControlOperationRoot,
  type BusinessDeletionControlProgressRecord,
  type BusinessDeletionControlRetirementMarker,
  type BusinessDeletionControlTerminalEvidenceRecord,
} from "../src/business-deletion-control-store.js";
import {
  BusinessDeletionControlPersistence,
  BusinessDeletionControlPersistenceConflictError,
  BusinessDeletionControlPersistenceDataIntegrityError,
  BusinessDeletionControlPersistenceUnavailableError,
} from "../src/business-deletion-control-persistence.js";

type Item =
  Record<string, AttributeValue>;

const tableName =
  "deletion-control-table";

const operationId =
  "11111111-1111-4111-8111-111111111111";

const manifestDigest =
  "a".repeat(64);

const requestDigest =
  "b".repeat(64);

const componentDigest =
  "c".repeat(64);

const leaseDigest =
  "d".repeat(64);

const evidenceDigest =
  "e".repeat(64);

const createdAt =
  "2026-08-07T12:00:00.000Z";

const updatedAt =
  "2026-08-07T12:01:00.000Z";

function operation(
  overrides:
    Partial<BusinessDeletionControlOperationRoot> = {},
): BusinessDeletionControlOperationRoot {
  return {
    pk:
      `DEL#OP#${operationId}`,
    sk:
      "ROOT",
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "operation-root",
    operationId,
    manifestIntegrityDigest:
      manifestDigest,
    policyVersion:
      1,
    topologyVersion:
      1,
    expectedComponentCount:
      2,
    state:
      "planned",
    stateVersion:
      1,
    legalHoldStatus:
      "inactive",
    legalHoldVersion:
      1,
    completedComponentCount:
      0,
    createdAt,
    updatedAt:
      createdAt,
    ...overrides,
  };
}

function claim(
  overrides:
    Partial<BusinessDeletionControlIdempotencyClaim> = {},
): BusinessDeletionControlIdempotencyClaim {
  return {
    pk:
      `DEL#IDEM#${requestDigest}`,
    sk:
      "CLAIM",
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "idempotency-claim",
    pseudonymousRequestDigest:
      requestDigest,
    operationId,
    manifestIntegrityDigest:
      manifestDigest,
    stateVersion:
      1,
    createdAt,
    ...overrides,
  };
}

function holdRecord(): BusinessDeletionControlLegalHoldRecord {
  return {
    pk:
      `DEL#OP#${operationId}`,
    sk:
      "HOLD#0000000001",
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "legal-hold-snapshot",
    operationId,
    status:
      "inactive",
    authority:
      "compliance-control",
    version:
      1,
    observedAt:
      createdAt,
    evidenceReferenceHash:
      evidenceDigest,
  };
}

function progress(
  overrides:
    Partial<BusinessDeletionControlProgressRecord> = {},
): BusinessDeletionControlProgressRecord {
  return {
    pk:
      `DEL#OP#${operationId}`,
    sk:
      "STEP#000001",
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "progress",
    operationId,
    manifestIntegrityDigest:
      manifestDigest,
    stepIndex:
      1,
    componentRangeDigest:
      componentDigest,
    expectedComponentCount:
      2,
    completedComponentCount:
      0,
    state:
      "pending",
    stateVersion:
      1,
    attemptCount:
      0,
    leaseVersion:
      0,
    createdAt,
    updatedAt:
      createdAt,
    ...overrides,
  };
}

function terminalEvidence(
  overrides:
    Partial<BusinessDeletionControlTerminalEvidenceRecord> = {},
): BusinessDeletionControlTerminalEvidenceRecord {
  return {
    pk:
      `DEL#OP#${operationId}`,
    sk:
      "EVIDENCE",
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "terminal-evidence",
    operationId,
    policyVersion:
      1,
    topologyVersion:
      1,
    manifestIntegrityDigest:
      manifestDigest,
    expectedComponentCount:
      2,
    deletedComponentCount:
      2,
    completedAt:
      "2026-08-07T12:10:00.000Z",
    outcome:
      "active-store-components-deleted",
    backupDisclosureVersion:
      1,
    backupDisclosure:
      "active-store-only-pitr-backups-and-exports-may-retain-until-expiry",
    retentionMode:
      "audit-policy-retained",
    ...overrides,
  };
}

function retirementMarker(): BusinessDeletionControlRetirementMarker {
  return {
    pk:
      `DEL#OP#${operationId}`,
    sk:
      "RETIRE",
    schemaVersion:
      BUSINESS_DELETION_CONTROL_STORE_SCHEMA_VERSION,
    keyVersion:
      BUSINESS_DELETION_CONTROL_STORE_KEY_VERSION,
    kind:
      "retirement-marker",
    operationId,
    terminalAt:
      "2026-08-07T12:10:00.000Z",
    retireAfter:
      "2026-11-05T12:10:00.000Z",
    ttlEpochSeconds:
      1793880600,
    scope:
      "transient-control-records-only",
    ttlPurpose:
      "cleanup-only-not-deletion-proof",
  };
}

function storedItem(
  record:
    | BusinessDeletionControlOperationRoot
    | BusinessDeletionControlIdempotencyClaim
    | BusinessDeletionControlProgressRecord
    | BusinessDeletionControlTerminalEvidenceRecord,
): Item {
  const item:
    Item = {
      pk: {
        S:
          record.pk,
      },
      sk: {
        S:
          record.sk,
      },
      kind: {
        S:
          record.kind,
      },
      schemaVersion: {
        N:
          String(
            record.schemaVersion,
          ),
      },
      keyVersion: {
        N:
          String(
            record.keyVersion,
          ),
      },
      operationId: {
        S:
          record.operationId,
      },
      recordJson: {
        S:
          JSON.stringify(
            record,
          ),
      },
    };

  if (
    record.kind ===
    "operation-root"
  ) {
    item.state = {
      S:
        record.state,
    };

    item.stateVersion = {
      N:
        String(
          record.stateVersion,
        ),
    };

    item.legalHoldVersion = {
      N:
        String(
          record.legalHoldVersion,
        ),
    };

    item.manifestIntegrityDigest = {
      S:
        record.manifestIntegrityDigest,
    };
  }

  if (
    record.kind ===
    "idempotency-claim"
  ) {
    item.stateVersion = {
      N:
        String(
          record.stateVersion,
        ),
    };

    item.pseudonymousRequestDigest = {
      S:
        record.pseudonymousRequestDigest,
    };

    item.manifestIntegrityDigest = {
      S:
        record.manifestIntegrityDigest,
    };

    if (record.terminalAt) {
      item.terminalAt = {
        S:
          record.terminalAt,
      };
    }

    if (
      record.ttlEpochSeconds !==
      undefined
    ) {
      item.ttl = {
        N:
          String(
            record.ttlEpochSeconds,
          ),
      };
    }
  }

  if (
    record.kind ===
    "progress"
  ) {
    item.state = {
      S:
        record.state,
    };

    item.stateVersion = {
      N:
        String(
          record.stateVersion,
        ),
    };

    item.leaseVersion = {
      N:
        String(
          record.leaseVersion,
        ),
    };

    item.manifestIntegrityDigest = {
      S:
        record.manifestIntegrityDigest,
    };

    if (record.lease) {
      item.leaseTokenDigest = {
        S:
          record.lease.tokenDigest,
      };
    }
  }

  if (
    record.kind ===
    "terminal-evidence"
  ) {
    item.manifestIntegrityDigest = {
      S:
        record.manifestIntegrityDigest,
    };
  }

  return item;
}

function storeWith(
  send:
    ReturnType<typeof vi.fn>,
): BusinessDeletionControlPersistence {
  return new BusinessDeletionControlPersistence(
    {
      region:
        "us-east-1",
      tableName,
    },
    {
      send,
    } as unknown as
      DynamoDBClient,
  );
}

function commandFrom(
  send:
    ReturnType<typeof vi.fn>,
  index = 0,
): unknown {
  return send.mock.calls[index]?.[0];
}

describe(
  "deletion control persistence adapter",
  () => {
    it("rejects malformed configuration without reading process environment", () => {
      const send =
        vi.fn();

      expect(
        () =>
          new BusinessDeletionControlPersistence(
            {
              region:
                "us-east-1 ",
              tableName,
            },
            {
              send,
            } as unknown as
              DynamoDBClient,
          ),
      ).toThrow(
        "configuration is invalid",
      );

      expect(
        () =>
          new BusinessDeletionControlPersistence(
            {
              region:
                "us-east-1",
              tableName:
                "x",
            },
            {
              send,
            } as unknown as
              DynamoDBClient,
          ),
      ).toThrow(
        "configuration is invalid",
      );
    });

    it("gets an operation by exact opaque key with a strongly consistent GetItem", async () => {
      const expected =
        operation();

      const send =
        vi.fn()
          .mockResolvedValue({
            Item:
              storedItem(
                expected,
              ),
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.getOperation(
          operationId,
        ),
      ).resolves.toEqual(
        expected,
      );

      expect(
        send,
      ).toHaveBeenCalledTimes(
        1,
      );

      const command =
        commandFrom(
          send,
        );

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
          tableName,
        Key: {
          pk: {
            S:
              `DEL#OP#${operationId}`,
          },
          sk: {
            S:
              "ROOT",
          },
        },
        ConsistentRead:
          true,
      });
    });

    it("returns null for an absent exact-key record", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      await expect(
        store.getOperation(
          operationId,
        ),
      ).resolves.toBeNull();
    });

    it("fails closed when stored guard attributes disagree with recordJson", async () => {
      const expected =
        operation();

      const item =
        storedItem(
          expected,
        );

      item.state = {
        S:
          "ready",
      };

      const send =
        vi.fn()
          .mockResolvedValue({
            Item:
              item,
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.getOperation(
          operationId,
        ),
      ).rejects.toBeInstanceOf(
        BusinessDeletionControlPersistenceDataIntegrityError,
      );
    });

    it("fails closed on malformed record JSON without exposing it in the error", async () => {
      const item =
        storedItem(
          operation(),
        );

      item.recordJson = {
        S:
          '{"ownerId":"secret"',
      };

      const send =
        vi.fn()
          .mockResolvedValue({
            Item:
              item,
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.getOperation(
          operationId,
        ),
      ).rejects.toMatchObject({
        name:
          "BusinessDeletionControlPersistenceDataIntegrityError",
        message:
          "Deletion control persistence data failed validation.",
      });
    });

    it("gets the pseudonymous idempotency claim by exact key", async () => {
      const expected =
        claim();

      const send =
        vi.fn()
          .mockResolvedValue({
            Item:
              storedItem(
                expected,
              ),
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.getIdempotencyClaim(
          requestDigest,
        ),
      ).resolves.toEqual(
        expected,
      );

      const command =
        commandFrom(
          send,
        );

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
        command.input.Key,
      ).toEqual({
        pk: {
          S:
            `DEL#IDEM#${requestDigest}`,
        },
        sk: {
          S:
            "CLAIM",
        },
      });
    });

    it("gets progress only by operation and step exact key", async () => {
      const expected =
        progress();

      const send =
        vi.fn()
          .mockResolvedValue({
            Item:
              storedItem(
                expected,
              ),
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.getProgress(
          operationId,
          1,
        ),
      ).resolves.toEqual(
        expected,
      );

      const command =
        commandFrom(
          send,
        );

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
        command.input.Key,
      ).toEqual({
        pk: {
          S:
            `DEL#OP#${operationId}`,
        },
        sk: {
          S:
            "STEP#000001",
        },
      });
    });

    it("atomically creates operation root and idempotency claim with create-only conditions", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      await store.createOperationAndClaim(
        operation(),
        claim(),
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        TransactWriteItemsCommand,
      );

      if (
        !(
          command instanceof
          TransactWriteItemsCommand
        )
      ) {
        throw new Error(
          "Expected TransactWriteItemsCommand.",
        );
      }

      expect(
        command.input.TransactItems,
      ).toHaveLength(
        2,
      );

      for (
        const action of
        command.input.TransactItems ??
        []
      ) {
        expect(
          action.Put?.TableName,
        ).toBe(
          tableName,
        );

        expect(
          action.Put?.ConditionExpression,
        ).toBe(
          "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",
        );

        expect(
          action.Put?.ExpressionAttributeNames,
        ).toEqual({
          "#pk":
            "pk",
          "#sk":
            "sk",
        });
      }

      expect(
        command.input.ClientRequestToken,
      ).toBeUndefined();

      const firstKey =
        command.input.TransactItems?.[0]?.Put?.Item;

      const secondKey =
        command.input.TransactItems?.[1]?.Put?.Item;

      expect(
        firstKey?.pk,
      ).not.toEqual(
        secondKey?.pk,
      );
    });

    it("does not allow an operation and claim with different immutable bindings", async () => {
      const send =
        vi.fn();

      const store =
        storeWith(
          send,
        );

      await expect(
        store.createOperationAndClaim(
          operation(),
          claim({
            operationId:
              "22222222-2222-4222-8222-222222222222",
          }),
        ),
      ).rejects.toBeInstanceOf(
        BusinessDeletionControlPersistenceDataIntegrityError,
      );

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it("maps transaction conditional cancellation to a narrow conflict", async () => {
      const send =
        vi.fn()
          .mockRejectedValue({
            name:
              "TransactionCanceledException",
            CancellationReasons: [
              {
                Code:
                  "ConditionalCheckFailed",
              },
              {
                Code:
                  "None",
              },
            ],
            message:
              "raw database message",
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.createOperationAndClaim(
          operation(),
          claim(),
        ),
      ).rejects.toMatchObject({
        name:
          "BusinessDeletionControlPersistenceConflictError",
        message:
          "Deletion control persistence condition failed.",
      });
    });

    it("maps non-conditional AWS failures to a generic unavailable error", async () => {
      const send =
        vi.fn()
          .mockRejectedValue({
            name:
              "ProvisionedThroughputExceededException",
            message:
              "raw database message",
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.putProgress(
          progress(),
        ),
      ).rejects.toMatchObject({
        name:
          "BusinessDeletionControlPersistenceUnavailableError",
        message:
          "Deletion control persistence is temporarily unavailable.",
      });
    });

    it("uses create-only PutItem for legal-hold snapshots", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      await store.putLegalHoldSnapshot(
        holdRecord(),
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        PutItemCommand,
      );

      if (
        !(
          command instanceof
          PutItemCommand
        )
      ) {
        throw new Error(
          "Expected PutItemCommand.",
        );
      }

      expect(
        command.input.ConditionExpression,
      ).toBe(
        "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",
      );
    });

    it("uses create-only PutItem for progress records", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      await store.putProgress(
        progress(),
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        PutItemCommand,
      );
    });

    it("never writes a TTL attribute on terminal evidence", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      await store.putTerminalEvidence(
        terminalEvidence(),
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        PutItemCommand,
      );

      if (
        !(
          command instanceof
          PutItemCommand
        )
      ) {
        throw new Error(
          "Expected PutItemCommand.",
        );
      }

      expect(
        command.input.Item,
      ).not.toHaveProperty(
        "ttl",
      );
    });

    it("gets terminal evidence by exact opaque key with a strongly consistent GetItem", async () => {
      const expected =
        terminalEvidence();

      const send =
        vi.fn()
          .mockResolvedValue({
            Item:
              storedItem(
                expected,
              ),
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.getTerminalEvidence(
          operationId,
        ),
      ).resolves.toEqual(
        expected,
      );

      const command =
        commandFrom(
          send,
        );

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
          tableName,
        Key: {
          pk: {
            S:
              `DEL#OP#${operationId}`,
          },
          sk: {
            S:
              "EVIDENCE",
          },
        },
        ConsistentRead:
          true,
      });
    });

    it("atomically completes the operation and creates terminal evidence", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      const completedAt =
        "2026-08-07T12:10:00.000Z";

      const next =
        operation({
          state:
            "completed",
          stateVersion:
            5,
          completedComponentCount:
            2,
          updatedAt:
            completedAt,
          terminalAt:
            completedAt,
          retireAfter:
            "2026-11-05T12:10:00.000Z",
        });

      await store.finalizeOperationAndTerminalEvidence(
        {
          operationId,
          expectedState:
            "partially-complete",
          expectedStateVersion:
            4,
          expectedLegalHoldVersion:
            1,
        },
        next,
        terminalEvidence(),
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        TransactWriteItemsCommand,
      );

      if (
        !(
          command instanceof
          TransactWriteItemsCommand
        )
      ) {
        throw new Error(
          "Expected TransactWriteItemsCommand.",
        );
      }

      expect(
        command.input.TransactItems,
      ).toHaveLength(2);

      const update =
        command.input.TransactItems?.[0]?.Update;

      const put =
        command.input.TransactItems?.[1]?.Put;

      expect(update?.TableName).toBe(
        tableName,
      );

      expect(
        update?.ConditionExpression,
      ).toBe(
        "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #state = :expectedState AND #stateVersion = :expectedStateVersion AND #legalHoldVersion = :expectedLegalHoldVersion",
      );

      expect(
        update?.ExpressionAttributeValues,
      ).toMatchObject({
        ":expectedState": {
          S:
            "partially-complete",
        },
        ":expectedStateVersion": {
          N:
            "4",
        },
        ":nextState": {
          S:
            "completed",
        },
        ":nextStateVersion": {
          N:
            "5",
        },
      });

      expect(put?.TableName).toBe(
        tableName,
      );

      expect(
        put?.ConditionExpression,
      ).toBe(
        "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",
      );

      expect(
        put?.Item,
      ).not.toHaveProperty(
        "ttl",
      );
    });

    it("rejects an atomic finalization whose evidence does not match the completed operation", async () => {
      const send =
        vi.fn();

      const store =
        storeWith(
          send,
        );

      const completedAt =
        "2026-08-07T12:10:00.000Z";

      const next =
        operation({
          state:
            "completed",
          stateVersion:
            5,
          completedComponentCount:
            2,
          updatedAt:
            completedAt,
          terminalAt:
            completedAt,
          retireAfter:
            "2026-11-05T12:10:00.000Z",
        });

      await expect(
        store.finalizeOperationAndTerminalEvidence(
          {
            operationId,
            expectedState:
              "partially-complete",
            expectedStateVersion:
              4,
            expectedLegalHoldVersion:
              1,
          },
          next,
          terminalEvidence({
            manifestIntegrityDigest:
              "f".repeat(64),
          }),
        ),
      ).rejects.toBeInstanceOf(
        BusinessDeletionControlPersistenceDataIntegrityError,
      );

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it("maps retirement-marker ttlEpochSeconds to the table cleanup ttl attribute", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      const marker =
        retirementMarker();

      await store.putRetirementMarker(
        marker,
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        PutItemCommand,
      );

      if (
        !(
          command instanceof
          PutItemCommand
        )
      ) {
        throw new Error(
          "Expected PutItemCommand.",
        );
      }

      expect(
        command.input.Item?.ttl,
      ).toEqual({
        N:
          String(
            marker.ttlEpochSeconds,
          ),
      });
    });

    it("updates operations only when the exact prior state and versions still exist", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      const next =
        operation({
          state:
            "ready",
          stateVersion:
            2,
          updatedAt,
        });

      await store.updateOperation(
        {
          operationId,
          expectedState:
            "planned",
          expectedStateVersion:
            1,
          expectedLegalHoldVersion:
            1,
        },
        next,
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        UpdateItemCommand,
      );

      if (
        !(
          command instanceof
          UpdateItemCommand
        )
      ) {
        throw new Error(
          "Expected UpdateItemCommand.",
        );
      }

      expect(
        command.input.ConditionExpression,
      ).toBe(
        "attribute_exists(#pk) AND attribute_exists(#sk) AND #kind = :kind AND #state = :expectedState AND #stateVersion = :expectedStateVersion AND #legalHoldVersion = :expectedLegalHoldVersion",
      );

      expect(
        command.input.ExpressionAttributeValues,
      ).toMatchObject({
        ":expectedState": {
          S:
            "planned",
        },
        ":expectedStateVersion": {
          N:
            "1",
        },
        ":expectedLegalHoldVersion": {
          N:
            "1",
        },
        ":nextState": {
          S:
            "ready",
        },
        ":nextStateVersion": {
          N:
            "2",
        },
      });
    });

    it("rejects an operation update that does not advance the state version exactly once", async () => {
      const send =
        vi.fn();

      const store =
        storeWith(
          send,
        );

      await expect(
        store.updateOperation(
          {
            operationId,
            expectedState:
              "planned",
            expectedStateVersion:
              1,
            expectedLegalHoldVersion:
              1,
          },
          operation({
            state:
              "ready",
            stateVersion:
              3,
            updatedAt,
          }),
        ),
      ).rejects.toBeInstanceOf(
        BusinessDeletionControlPersistenceDataIntegrityError,
      );

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it("maps operation conditional failure to the narrow conflict error", async () => {
      const send =
        vi.fn()
          .mockRejectedValue({
            name:
              "ConditionalCheckFailedException",
            message:
              "raw state details",
          });

      const store =
        storeWith(
          send,
        );

      await expect(
        store.updateOperation(
          {
            operationId,
            expectedState:
              "planned",
            expectedStateVersion:
              1,
            expectedLegalHoldVersion:
              1,
          },
          operation({
            state:
              "ready",
            stateVersion:
              2,
            updatedAt,
          }),
        ),
      ).rejects.toBeInstanceOf(
        BusinessDeletionControlPersistenceConflictError,
      );
    });

    it("requires absence of a lease token when acquiring the first progress lease", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      const next =
        progress({
          state:
            "executing",
          stateVersion:
            2,
          attemptCount:
            1,
          leaseVersion:
            1,
          lease: {
            tokenDigest:
              leaseDigest,
            version:
              1,
            acquiredAt:
              updatedAt,
            expiresAt:
              "2026-08-07T12:10:00.000Z",
          },
          updatedAt,
        });

      await store.updateProgress(
        {
          operationId,
          stepIndex:
            1,
          expectedState:
            "pending",
          expectedStateVersion:
            1,
          expectedLeaseVersion:
            0,
        },
        next,
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        UpdateItemCommand,
      );

      if (
        !(
          command instanceof
          UpdateItemCommand
        )
      ) {
        throw new Error(
          "Expected UpdateItemCommand.",
        );
      }

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "attribute_not_exists(#leaseTokenDigest)",
      );

      expect(
        command.input.UpdateExpression,
      ).toContain(
        "#leaseTokenDigest = :nextLeaseTokenDigest",
      );
    });

    it("binds the current lease token digest during leased progress mutation", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      const next =
        progress({
          state:
            "executing",
          stateVersion:
            3,
          attemptCount:
            1,
          leaseVersion:
            1,
          lease: {
            tokenDigest:
              leaseDigest,
            version:
              1,
            acquiredAt:
              updatedAt,
            expiresAt:
              "2026-08-07T12:10:00.000Z",
          },
          completedComponentCount:
            1,
          updatedAt:
            "2026-08-07T12:02:00.000Z",
        });

      await store.updateProgress(
        {
          operationId,
          stepIndex:
            1,
          expectedState:
            "executing",
          expectedStateVersion:
            2,
          expectedLeaseVersion:
            1,
          expectedLeaseTokenDigest:
            leaseDigest,
        },
        next,
      );

      const command =
        commandFrom(
          send,
        );

      if (
        !(
          command instanceof
          UpdateItemCommand
        )
      ) {
        throw new Error(
          "Expected UpdateItemCommand.",
        );
      }

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "#leaseTokenDigest = :expectedLeaseTokenDigest",
      );

      expect(
        command.input.ExpressionAttributeValues?.[
          ":expectedLeaseTokenDigest"
        ],
      ).toEqual({
        S:
          leaseDigest,
      });
    });

    it("removes the lease token when the next progress record releases its lease", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      const next =
        progress({
          state:
            "completed",
          stateVersion:
            3,
          attemptCount:
            1,
          leaseVersion:
            1,
          completedComponentCount:
            2,
          completedAt:
            "2026-08-07T12:03:00.000Z",
          updatedAt:
            "2026-08-07T12:03:00.000Z",
        });

      await store.updateProgress(
        {
          operationId,
          stepIndex:
            1,
          expectedState:
            "executing",
          expectedStateVersion:
            2,
          expectedLeaseVersion:
            1,
          expectedLeaseTokenDigest:
            leaseDigest,
        },
        next,
      );

      const command =
        commandFrom(
          send,
        );

      if (
        !(
          command instanceof
          UpdateItemCommand
        )
      ) {
        throw new Error(
          "Expected UpdateItemCommand.",
        );
      }

      expect(
        command.input.UpdateExpression,
      ).toContain(
        "REMOVE #leaseTokenDigest",
      );
    });

    it("retires an idempotency claim with immutable binding and cleanup TTL", async () => {
      const send =
        vi.fn()
          .mockResolvedValue({});

      const store =
        storeWith(
          send,
        );

      const current =
        claim();

      const next =
        claim({
          stateVersion:
            2,
          terminalAt:
            "2026-08-07T12:10:00.000Z",
          expireAfter:
            "2026-11-05T12:10:00.000Z",
          ttlEpochSeconds:
            1793880600,
          ttlPurpose:
            "cleanup-only-not-deletion-proof",
        });

      await store.persistIdempotencyRetirement(
        current,
        next,
      );

      const command =
        commandFrom(
          send,
        );

      expect(
        command,
      ).toBeInstanceOf(
        UpdateItemCommand,
      );

      if (
        !(
          command instanceof
          UpdateItemCommand
        )
      ) {
        throw new Error(
          "Expected UpdateItemCommand.",
        );
      }

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "attribute_not_exists(#terminalAt)",
      );

      expect(
        command.input.ConditionExpression,
      ).toContain(
        "#pseudonymousRequestDigest = :pseudonymousRequestDigest",
      );

      expect(
        command.input.ExpressionAttributeValues?.[
          ":ttl"
        ],
      ).toEqual({
        N:
          "1793880600",
      });
    });

    it("does not issue a write when idempotent retirement already has the same terminal binding", async () => {
      const send =
        vi.fn();

      const store =
        storeWith(
          send,
        );

      const retired =
        claim({
          stateVersion:
            2,
          terminalAt:
            "2026-08-07T12:10:00.000Z",
          expireAfter:
            "2026-11-05T12:10:00.000Z",
          ttlEpochSeconds:
            1793880600,
          ttlPurpose:
            "cleanup-only-not-deletion-proof",
        });

      await store.persistIdempotencyRetirement(
        retired,
        retired,
      );

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it("rejects extra persisted properties rather than silently storing privacy-sensitive fields", async () => {
      const send =
        vi.fn();

      const store =
        storeWith(
          send,
        );

      const unsafe =
        {
          ...progress(),
          ownerId:
            "should-never-persist",
        } as
          BusinessDeletionControlProgressRecord;

      await expect(
        store.putProgress(
          unsafe,
        ),
      ).rejects.toBeInstanceOf(
        BusinessDeletionControlPersistenceDataIntegrityError,
      );

      expect(
        send,
      ).not.toHaveBeenCalled();
    });

    it("keeps the adapter free of scan, query, delete, environment, handler, and runtime wiring", async () => {
      const {
        readFile,
      } =
        await import(
          "node:fs/promises"
        );

      const source =
        await readFile(
          new URL(
            "../src/business-deletion-control-persistence.ts",
            import.meta.url,
          ),
          "utf8",
        );

      for (
        const forbidden of
        [
          "ScanCommand",
          "QueryCommand",
          "DeleteItemCommand",
          "BatchWrite",
          "PartiQL",
          "process.env",
          "business-runtime",
          "./handler",
          "BusinessTable",
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
        "GetItemCommand",
      );

      expect(
        source,
      ).toContain(
        "PutItemCommand",
      );

      expect(
        source,
      ).toContain(
        "UpdateItemCommand",
      );

      expect(
        source,
      ).toContain(
        "TransactWriteItemsCommand",
      );
    });

    it("uses only generic persistence errors and never forwards raw AWS error text", async () => {
      expect(
        new BusinessDeletionControlPersistenceConflictError()
          .message,
      ).toBe(
        "Deletion control persistence condition failed.",
      );

      expect(
        new BusinessDeletionControlPersistenceUnavailableError()
          .message,
      ).toBe(
        "Deletion control persistence is temporarily unavailable.",
      );
    });
  },
);
