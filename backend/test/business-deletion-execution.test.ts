import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";
import {
  BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION,
  BUSINESS_DELETION_COMPONENT_BYTE_BUDGET,
  BUSINESS_DELETION_COMPONENT_ROLES,
  BUSINESS_DELETION_CONTROL_RETENTION_DAYS,
  BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
  BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS,
  BUSINESS_DELETION_TOPOLOGY_VERSION,
  DYNAMODB_TRANSACTION_ACTION_LIMIT,
  DYNAMODB_TRANSACTION_BYTE_LIMIT,
  MAX_ATOMIC_BUSINESS_COMPONENT_DELETIONS,
  createBusinessDeletionCompletionEvidence,
  createBusinessDeletionExecutionProgress,
  createBusinessDeletionManifest,
  planBusinessDeletionExecution,
  recordBusinessDeletionComponentCompletion,
  type BusinessDeletionComponentInput,
  type BusinessDeletionManifest,
} from "../src/business-deletion-execution.js";
import {
  BUSINESS_RETENTION_POLICY_VERSION,
} from "../src/business-retention-lifecycle.js";

const OWNER =
  "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const OTHER_OWNER =
  "BUSINESS#OWNER#BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const HASH_A =
  "a".repeat(64);

const HASH_B =
  "b".repeat(64);

const HASH_C =
  "c".repeat(64);

const OPERATION_ID =
  "123e4567-e89b-42d3-a456-426614174000";

const CREATED_AT =
  "2026-08-06T20:00:00.000Z";

function dynamoComponent(
  componentId:
    string,
  role:
    "ciphertext-primary" |
    "primary-index" |
    "derived-index" =
      "derived-index",
  input:
    Partial<{
      awsAccountId:
        string;
      awsRegion:
        string;
      partitionKey:
        string;
      sortKey:
        string;
      estimatedItemBytes:
        number;
    }> = {},
): BusinessDeletionComponentInput {
  return {
    componentId,
    role,
    locator: {
      system:
        "dynamodb",
      tableRole:
        "business-table",
      awsAccountId:
        input.awsAccountId ??
        "123456789012",
      awsRegion:
        input.awsRegion ??
        "us-east-1",
      partitionKey:
        input.partitionKey ??
        OWNER,
      sortKey:
        input.sortKey ??
        `BUSINESS#SENSITIVE#${componentId}`,
      estimatedItemBytes:
        input.estimatedItemBytes ??
        1024,
    },
  };
}

function externalComponent(
  componentId:
    string,
): BusinessDeletionComponentInput {
  return {
    componentId,
    role:
      "external-copy-reference",
    locator: {
      system:
        "external-copy",
      systemRole:
        "object-store",
      referenceDigest:
        HASH_C,
    },
  };
}

function manifest(
  input:
    Partial<{
      authorizedOwnerPartitionKey:
        string;
      targetOwnerPartitionKey:
        string;
      components:
        readonly BusinessDeletionComponentInput[];
      legalHoldStatus:
        "inactive" |
        "active";
      legalHoldVersion:
        number;
      legalHoldObservedAt:
        string;
      policyVersion:
        number;
      topologyVersion:
        number;
      createdAt:
        string;
    }> = {},
): BusinessDeletionManifest {
  return createBusinessDeletionManifest({
    operationId:
      OPERATION_ID,
    authorizedOwnerPartitionKey:
      input.authorizedOwnerPartitionKey ??
      OWNER,
    targetOwnerPartitionKey:
      input.targetOwnerPartitionKey ??
      OWNER,
    recordType:
      "banking-instrument",
    recordContextDigest:
      HASH_A,
    policyVersion:
      (
        input.policyVersion ??
        BUSINESS_RETENTION_POLICY_VERSION
      ) as typeof BUSINESS_RETENTION_POLICY_VERSION,
    topologyVersion:
      (
        input.topologyVersion ??
        BUSINESS_DELETION_TOPOLOGY_VERSION
      ) as typeof BUSINESS_DELETION_TOPOLOGY_VERSION,
    idempotencyKeyDigest:
      HASH_B,
    legalHoldSnapshot: {
      status:
        input.legalHoldStatus ??
        "inactive",
      authority:
        "compliance-control",
      version:
        input.legalHoldVersion ??
        7,
      observedAt:
        input.legalHoldObservedAt ??
        CREATED_AT,
      evidenceReferenceHash:
        HASH_C,
    },
    createdAt:
      input.createdAt ??
      CREATED_AT,
    components:
      input.components ?? [
        dynamoComponent(
          "ciphertext-primary",
          "ciphertext-primary",
        ),
        dynamoComponent(
          "derived-index-01",
        ),
      ],
  });
}

describe(
  "verified business deletion execution contracts",
  () => {
    it(
      "publishes the reviewed transaction and control-data boundaries",
      () => {
        expect(
          BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
        ).toBe(1);

        expect(
          BUSINESS_DELETION_TOPOLOGY_VERSION,
        ).toBe(1);

        expect(
          BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION,
        ).toBe(1);

        expect(
          DYNAMODB_TRANSACTION_ACTION_LIMIT,
        ).toBe(100);

        expect(
          DYNAMODB_TRANSACTION_BYTE_LIMIT,
        ).toBe(
          4 * 1024 * 1024,
        );

        expect(
          BUSINESS_DELETION_RESERVED_TRANSACTION_ACTIONS,
        ).toBe(2);

        expect(
          MAX_ATOMIC_BUSINESS_COMPONENT_DELETIONS,
        ).toBe(98);

        expect(
          BUSINESS_DELETION_COMPONENT_BYTE_BUDGET,
        ).toBe(
          DYNAMODB_TRANSACTION_BYTE_LIMIT -
          8 * 1024,
        );

        expect(
          BUSINESS_DELETION_CONTROL_RETENTION_DAYS,
        ).toBe(90);

        expect(
          BUSINESS_DELETION_COMPONENT_ROLES,
        ).toEqual([
          "ciphertext-primary",
          "primary-index",
          "derived-index",
          "external-copy-reference",
        ]);
      },
    );

    it(
      "creates an immutable canonical manifest with non-identifying digests",
      () => {
        const value =
          manifest({
            components: [
              dynamoComponent(
                "derived-index-01",
              ),
              dynamoComponent(
                "ciphertext-primary",
                "ciphertext-primary",
              ),
            ],
          });

        expect(
          value.components.map(
            (component) =>
              component.componentId,
          ),
        ).toEqual([
          "ciphertext-primary",
          "derived-index-01",
        ]);

        expect(
          value.expectedComponentCount,
        ).toBe(2);

        expect(
          value.ownerContextDigest,
        ).toMatch(
          /^[a-f0-9]{64}$/,
        );

        expect(
          value.ownerContextDigest,
        ).not.toContain(
          OWNER,
        );

        expect(
          value.manifestIntegrityDigest,
        ).toMatch(
          /^[a-f0-9]{64}$/,
        );

        expect(
          Object.isFrozen(value),
        ).toBe(true);

        expect(
          Object.isFrozen(
            value.components,
          ),
        ).toBe(true);

        expect(
          Object.isFrozen(
            value.components[0],
          ),
        ).toBe(true);

        expect(
          Object.isFrozen(
            value.components[0]
              ?.locator,
          ),
        ).toBe(true);
      },
    );

    it(
      "produces the same manifest digest for different input component order",
      () => {
        const first =
          manifest({
            components: [
              dynamoComponent(
                "ciphertext-primary",
                "ciphertext-primary",
              ),
              dynamoComponent(
                "derived-index-01",
              ),
              dynamoComponent(
                "primary-index-01",
                "primary-index",
              ),
            ],
          });

        const second =
          manifest({
            components: [
              dynamoComponent(
                "primary-index-01",
                "primary-index",
              ),
              dynamoComponent(
                "derived-index-01",
              ),
              dynamoComponent(
                "ciphertext-primary",
                "ciphertext-primary",
              ),
            ],
          });

        expect(
          second.manifestIntegrityDigest,
        ).toBe(
          first.manifestIntegrityDigest,
        );
      },
    );

    it(
      "fails closed when the target owner differs from server-derived scope",
      () => {
        expect(
          () =>
            manifest({
              targetOwnerPartitionKey:
                OTHER_OWNER,
            }),
        ).toThrow(
          "Deletion manifest owner scope does not match the server-derived authorization scope.",
        );
      },
    );

    it.each([
      "raw-owner",
      " BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      "BUSINESS#OWNER#short",
    ])(
      "rejects a noncanonical owner partition: %s",
      (owner: string) => {
        expect(
          () =>
            manifest({
              authorizedOwnerPartitionKey:
                owner,
              targetOwnerPartitionKey:
                owner,
            }),
        ).toThrow(
          "must be a canonical pseudonymous owner partition",
        );
      },
    );

    it(
      "rejects unsupported policy and topology versions",
      () => {
        expect(
          () =>
            manifest({
              policyVersion:
                2,
            }),
        ).toThrow(
          "Deletion manifest policy version is unsupported.",
        );

        expect(
          () =>
            manifest({
              topologyVersion:
                2,
            }),
        ).toThrow(
          "Deletion manifest topology version is unsupported.",
        );
      },
    );

    it(
      "requires exactly one ciphertext-primary component",
      () => {
        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "derived-index-01",
                ),
              ],
            }),
        ).toThrow(
          "requires exactly one ciphertext-primary",
        );

        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary-01",
                  "ciphertext-primary",
                ),
                dynamoComponent(
                  "ciphertext-primary-02",
                  "ciphertext-primary",
                ),
              ],
            }),
        ).toThrow(
          "requires exactly one ciphertext-primary",
        );
      },
    );

    it(
      "rejects duplicate component IDs and duplicate item targets",
      () => {
        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                ),
                dynamoComponent(
                  "ciphertext-primary",
                ),
              ],
            }),
        ).toThrow(
          "component IDs must be unique",
        );

        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                  {
                    sortKey:
                      "BUSINESS#SENSITIVE#same",
                    estimatedItemBytes:
                      100,
                  },
                ),
                dynamoComponent(
                  "derived-index-01",
                  "derived-index",
                  {
                    sortKey:
                      "BUSINESS#SENSITIVE#same",
                    estimatedItemBytes:
                      200,
                  },
                ),
              ],
            }),
        ).toThrow(
          "locators must target distinct components",
        );
      },
    );

    it(
      "binds component roles to their supported locator systems",
      () => {
        const wrongExternal:
          BusinessDeletionComponentInput = {
            componentId:
              "external-copy-01",
            role:
              "external-copy-reference",
            locator: {
              system:
                "dynamodb",
              tableRole:
                "business-table",
              awsAccountId:
                "123456789012",
              awsRegion:
                "us-east-1",
              partitionKey:
                OWNER,
              sortKey:
                "BUSINESS#COPY#01",
              estimatedItemBytes:
                100,
            },
          };

        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                ),
                wrongExternal,
              ],
            }),
        ).toThrow(
          "External-copy components require an external locator.",
        );

        const wrongDynamo:
          BusinessDeletionComponentInput = {
            componentId:
              "derived-index-01",
            role:
              "derived-index",
            locator: {
              system:
                "external-copy",
              systemRole:
                "provider",
              referenceDigest:
                HASH_C,
            },
          };

        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                ),
                wrongDynamo,
              ],
            }),
        ).toThrow(
          "DynamoDB deletion components require a DynamoDB locator.",
        );
      },
    );

    it(
      "rejects malformed DynamoDB and external locators",
      () => {
        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                  {
                    awsAccountId:
                      "123",
                  },
                ),
              ],
            }),
        ).toThrow(
          "AWS account ID is invalid",
        );

        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                  {
                    awsRegion:
                      "moon-1",
                  },
                ),
              ],
            }),
        ).toThrow(
          "AWS Region is invalid",
        );

        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                  {
                    estimatedItemBytes:
                      400 * 1024 + 1,
                  },
                ),
              ],
            }),
        ).toThrow(
          "exceed the supported item limit",
        );

        expect(
          () =>
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                ),
                {
                  ...externalComponent(
                    "external-copy-01",
                  ),
                  locator: {
                    system:
                      "external-copy",
                    systemRole:
                      "provider",
                    referenceDigest:
                      "not-a-digest",
                  },
                },
              ],
            }),
        ).toThrow(
          "External copy reference must be a lowercase SHA-256 digest.",
        );
      },
    );

    it(
      "rejects a future legal-hold observation and malformed evidence",
      () => {
        expect(
          () =>
            manifest({
              legalHoldObservedAt:
                "2026-08-06T20:00:01.000Z",
            }),
        ).toThrow(
          "Legal-hold observation cannot follow manifest creation.",
        );

        expect(
          () =>
            createBusinessDeletionManifest({
              operationId:
                OPERATION_ID,
              authorizedOwnerPartitionKey:
                OWNER,
              targetOwnerPartitionKey:
                OWNER,
              recordType:
                "trade-record",
              recordContextDigest:
                HASH_A,
              policyVersion:
                BUSINESS_RETENTION_POLICY_VERSION,
              topologyVersion:
                BUSINESS_DELETION_TOPOLOGY_VERSION,
              idempotencyKeyDigest:
                HASH_B,
              legalHoldSnapshot: {
                status:
                  "inactive",
                authority:
                  "compliance-control",
                version:
                  1,
                observedAt:
                  CREATED_AT,
                evidenceReferenceHash:
                  "not-a-digest",
              },
              createdAt:
                CREATED_AT,
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                ),
              ],
            }),
        ).toThrow(
          "Legal-hold evidence must be a lowercase SHA-256 digest.",
        );
      },
    );

    it(
      "selects a single atomic transaction when all reviewed bounds fit",
      () => {
        const plan =
          planBusinessDeletionExecution(
            manifest(),
          );

        expect(
          plan.mode,
        ).toBe(
          "atomic-single-transaction",
        );

        if (
          plan.mode !==
          "atomic-single-transaction"
        ) {
          throw new Error(
            "Expected an atomic execution plan.",
          );
        }

        expect(
          plan.reasons,
        ).toEqual([]);

        expect(
          plan.steps,
        ).toHaveLength(1);

        expect(
          plan.steps[0],
        ).toMatchObject({
          kind:
            "dynamodb-transaction",
          componentDeleteCount:
            2,
          transactionActionCount:
            4,
          requiredLegalHoldVersion:
            7,
        });
      },
    );

    it(
      "permits exactly 98 component deletes in one atomic transaction",
      () => {
        const components:
          BusinessDeletionComponentInput[] = [
            dynamoComponent(
              "ciphertext-primary",
              "ciphertext-primary",
              {
                estimatedItemBytes:
                  1,
              },
            ),
          ];

        for (
          let index = 1;
          index <= 97;
          index++
        ) {
          components.push(
            dynamoComponent(
              `derived-index-${String(index).padStart(3, "0")}`,
              "derived-index",
              {
                estimatedItemBytes:
                  1,
              },
            ),
          );
        }

        const plan =
          planBusinessDeletionExecution(
            manifest({
              components,
            }),
          );

        expect(
          plan.mode,
        ).toBe(
          "atomic-single-transaction",
        );

        if (
          plan.mode !==
          "atomic-single-transaction"
        ) {
          throw new Error(
            "Expected an atomic execution plan.",
          );
        }

        expect(
          plan.steps[0]
            .transactionActionCount,
        ).toBe(100);
      },
    );

    it(
      "uses resumable chunks when component count exceeds the atomic budget",
      () => {
        const components:
          BusinessDeletionComponentInput[] = [
            dynamoComponent(
              "ciphertext-primary",
              "ciphertext-primary",
              {
                estimatedItemBytes:
                  1,
              },
            ),
          ];

        for (
          let index = 1;
          index <= 98;
          index++
        ) {
          components.push(
            dynamoComponent(
              `derived-index-${String(index).padStart(3, "0")}`,
              "derived-index",
              {
                estimatedItemBytes:
                  1,
              },
            ),
          );
        }

        const plan =
          planBusinessDeletionExecution(
            manifest({
              components,
            }),
          );

        expect(
          plan.mode,
        ).toBe(
          "resumable-chunks",
        );

        if (
          plan.mode !==
          "resumable-chunks"
        ) {
          throw new Error(
            "Expected a resumable execution plan.",
          );
        }

        expect(
          plan.reasons,
        ).toContain(
          "component-count",
        );

        expect(
          plan.steps,
        ).toHaveLength(2);

        for (
          const step of
          plan.steps
        ) {
          if (
            step.kind ===
            "dynamodb-transaction"
          ) {
            expect(
              step.transactionActionCount,
            ).toBeLessThanOrEqual(
              100,
            );
          }
        }
      },
    );

    it(
      "uses resumable chunks when the aggregate byte budget is exceeded",
      () => {
        const components:
          BusinessDeletionComponentInput[] = [
            dynamoComponent(
              "ciphertext-primary",
              "ciphertext-primary",
              {
                estimatedItemBytes:
                  400 * 1024,
              },
            ),
          ];

        for (
          let index = 1;
          index <= 10;
          index++
        ) {
          components.push(
            dynamoComponent(
              `derived-index-${String(index).padStart(2, "0")}`,
              "derived-index",
              {
                estimatedItemBytes:
                  400 * 1024,
              },
            ),
          );
        }

        const plan =
          planBusinessDeletionExecution(
            manifest({
              components,
            }),
          );

        expect(
          plan.mode,
        ).toBe(
          "resumable-chunks",
        );

        if (
          plan.mode !==
          "resumable-chunks"
        ) {
          throw new Error(
            "Expected a resumable execution plan.",
          );
        }

        expect(
          plan.reasons,
        ).toContain(
          "aggregate-byte-budget",
        );

        expect(
          plan.steps,
        ).toHaveLength(2);
      },
    );

    it(
      "uses resumable steps across AWS boundaries",
      () => {
        const plan =
          planBusinessDeletionExecution(
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                  {
                    awsRegion:
                      "us-east-1",
                  },
                ),
                dynamoComponent(
                  "derived-index-01",
                  "derived-index",
                  {
                    awsRegion:
                      "us-west-2",
                  },
                ),
              ],
            }),
          );

        expect(
          plan.mode,
        ).toBe(
          "resumable-chunks",
        );

        if (
          plan.mode !==
          "resumable-chunks"
        ) {
          throw new Error(
            "Expected a resumable execution plan.",
          );
        }

        expect(
          plan.reasons,
        ).toContain(
          "multiple-aws-boundaries",
        );

        expect(
          plan.steps,
        ).toHaveLength(2);
      },
    );

    it(
      "requires a verified resumable step for external copies",
      () => {
        const plan =
          planBusinessDeletionExecution(
            manifest({
              components: [
                dynamoComponent(
                  "ciphertext-primary",
                  "ciphertext-primary",
                ),
                externalComponent(
                  "external-copy-01",
                ),
              ],
            }),
          );

        expect(
          plan.mode,
        ).toBe(
          "resumable-chunks",
        );

        if (
          plan.mode !==
          "resumable-chunks"
        ) {
          throw new Error(
            "Expected a resumable execution plan.",
          );
        }

        expect(
          plan.reasons,
        ).toContain(
          "external-copy",
        );

        expect(
          plan.steps.map(
            (step) =>
              step.kind,
          ),
        ).toEqual([
          "dynamodb-transaction",
          "external-verified-step",
        ]);
      },
    );

    it(
      "blocks every execution step under an active legal hold",
      () => {
        const plan =
          planBusinessDeletionExecution(
            manifest({
              legalHoldStatus:
                "active",
            }),
          );

        expect(plan).toEqual({
          mode:
            "blocked-legal-hold",
          operationId:
            OPERATION_ID,
          manifestIntegrityDigest:
            expect.stringMatching(
              /^[a-f0-9]{64}$/,
            ),
          expectedComponentCount:
            2,
          reasons: [
            "active-legal-hold",
          ],
          steps: [],
        });
      },
    );

    it(
      "prevents progress and completion under an active legal hold",
      () => {
        const value =
          manifest({
            legalHoldStatus:
              "active",
          });

        expect(
          () =>
            createBusinessDeletionExecutionProgress(
              value,
              "2026-08-06T20:00:01.000Z",
            ),
        ).toThrow(
          "cannot progress under an active legal hold",
        );
      },
    );

    it(
      "creates bound planned progress after manifest creation",
      () => {
        const value =
          manifest();

        const progress =
          createBusinessDeletionExecutionProgress(
            value,
            "2026-08-06T20:00:01.000Z",
          );

        expect(progress).toEqual({
          schemaVersion:
            BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
          operationId:
            OPERATION_ID,
          manifestIntegrityDigest:
            value.manifestIntegrityDigest,
          idempotencyKeyDigest:
            HASH_B,
          state:
            "planned",
          completedComponentIds:
            [],
          updatedAt:
            "2026-08-06T20:00:01.000Z",
        });

        expect(
          Object.isFrozen(progress),
        ).toBe(true);
      },
    );

    it(
      "advances deletion progress monotonically and treats replay as idempotent",
      () => {
        const value =
          manifest();

        const planned =
          createBusinessDeletionExecutionProgress(
            value,
            "2026-08-06T20:00:01.000Z",
          );

        const partial =
          recordBusinessDeletionComponentCompletion(
            value,
            planned,
            [
              "derived-index-01",
            ],
            "2026-08-06T20:00:02.000Z",
          );

        expect(
          partial.state,
        ).toBe(
          "in-progress",
        );

        expect(
          partial.completedComponentIds,
        ).toEqual([
          "derived-index-01",
        ]);

        const replay =
          recordBusinessDeletionComponentCompletion(
            value,
            partial,
            [
              "derived-index-01",
            ],
            "2026-08-06T20:00:03.000Z",
          );

        expect(
          replay.completedComponentIds,
        ).toEqual([
          "derived-index-01",
        ]);

        const completed =
          recordBusinessDeletionComponentCompletion(
            value,
            replay,
            [
              "ciphertext-primary",
            ],
            "2026-08-06T20:00:04.000Z",
          );

        expect(
          completed.state,
        ).toBe(
          "completed",
        );

        expect(
          completed.completedAt,
        ).toBe(
          "2026-08-06T20:00:04.000Z",
        );

        expect(
          completed.completedComponentIds,
        ).toEqual([
          "ciphertext-primary",
          "derived-index-01",
        ]);
      },
    );

    it(
      "rejects unknown components, time rollback, and manifest binding conflicts",
      () => {
        const value =
          manifest();

        const planned =
          createBusinessDeletionExecutionProgress(
            value,
            "2026-08-06T20:00:01.000Z",
          );

        expect(
          () =>
            recordBusinessDeletionComponentCompletion(
              value,
              planned,
              [
                "unknown-component",
              ],
              "2026-08-06T20:00:02.000Z",
            ),
        ).toThrow(
          "references an unknown component",
        );

        expect(
          () =>
            recordBusinessDeletionComponentCompletion(
              value,
              planned,
              [
                "ciphertext-primary",
              ],
              "2026-08-06T20:00:00.000Z",
            ),
        ).toThrow(
          "cannot move backward in time",
        );

        const other =
          manifest({
            components: [
              dynamoComponent(
                "ciphertext-primary",
                "ciphertext-primary",
              ),
              dynamoComponent(
                "derived-index-02",
              ),
            ],
          });

        expect(
          () =>
            recordBusinessDeletionComponentCompletion(
              other,
              planned,
              [
                "ciphertext-primary",
              ],
              "2026-08-06T20:00:02.000Z",
            ),
        ).toThrow(
          "does not match its manifest and idempotency binding",
        );
      },
    );

    it(
      "refuses completion evidence until every component is verified",
      () => {
        const value =
          manifest();

        const planned =
          createBusinessDeletionExecutionProgress(
            value,
            "2026-08-06T20:00:01.000Z",
          );

        const partial =
          recordBusinessDeletionComponentCompletion(
            value,
            planned,
            [
              "ciphertext-primary",
            ],
            "2026-08-06T20:00:02.000Z",
          );

        expect(
          () =>
            createBusinessDeletionCompletionEvidence(
              value,
              partial,
            ),
        ).toThrow(
          "requires every manifest component to be verified",
        );
      },
    );

    it(
      "creates sanitized active-store completion evidence without sensitive locators",
      () => {
        const value =
          manifest();

        const planned =
          createBusinessDeletionExecutionProgress(
            value,
            "2026-08-06T20:00:01.000Z",
          );

        const completed =
          recordBusinessDeletionComponentCompletion(
            value,
            planned,
            value.components.map(
              (component) =>
                component.componentId,
            ),
            "2026-08-06T20:00:02.000Z",
          );

        const evidence =
          createBusinessDeletionCompletionEvidence(
            value,
            completed,
          );

        expect(evidence).toEqual({
          schemaVersion:
            BUSINESS_DELETION_EXECUTION_SCHEMA_VERSION,
          operationId:
            OPERATION_ID,
          policyVersion:
            BUSINESS_RETENTION_POLICY_VERSION,
          topologyVersion:
            BUSINESS_DELETION_TOPOLOGY_VERSION,
          manifestIntegrityDigest:
            value.manifestIntegrityDigest,
          expectedComponentCount:
            2,
          deletedComponentCount:
            2,
          completedAt:
            "2026-08-06T20:00:02.000Z",
          outcome:
            "active-store-components-deleted",
          backupDisclosureVersion:
            BUSINESS_DELETION_BACKUP_DISCLOSURE_VERSION,
          backupDisclosure:
            "active-store-only-pitr-backups-and-exports-may-retain-until-expiry",
        });

        const serialized =
          JSON.stringify(
            evidence,
          );

        for (
          const forbidden of [
            OWNER,
            "BUSINESS#SENSITIVE#",
            HASH_B,
            "ciphertext",
            "recordId",
            "errorMessage",
          ]
        ) {
          expect(
            serialized,
          ).not.toContain(
            forbidden,
          );
        }

        expect(
          Object.isFrozen(evidence),
        ).toBe(true);
      },
    );

    it(
      "keeps the contract free of AWS SDK, persistence, API, environment, and logging runtime dependencies",
      () => {
        const source =
          readFileSync(
            new URL(
              "../src/business-deletion-execution.ts",
              import.meta.url,
            ),
            "utf8",
          );

        for (
          const forbidden of [
            "@aws-sdk",
            "DynamoDBClient",
            "TransactWriteItemsCommand",
            "DeleteItemCommand",
            "PutItemCommand",
            "UpdateItemCommand",
            "BusinessStore",
            "process.env",
            "APIGateway",
            "rawPath",
            "routeKey",
            "safeSecurityLog",
            "console.",
          ]
        ) {
          expect(
            source,
          ).not.toContain(
            forbidden,
          );
        }
      },
    );
  },
);
