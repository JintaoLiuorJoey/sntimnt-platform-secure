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
  BUSINESS_DELETION_TOPOLOGY_VERSION,
  createBusinessDeletionManifest,
  planBusinessDeletionExecution,
  type BusinessDeletionComponentInput,
  type BusinessDeletionExecutionStep,
  type BusinessDeletionManifest,
} from "../src/business-deletion-execution.js";
import {
  BUSINESS_DELETION_EXECUTOR_BOUNDARY,
  BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
  createManifestBoundBusinessDeletionExecutionPort,
  type BusinessDeletionAbsenceVerifier,
  type BusinessDeletionDynamoDbTransactionAdapterInput,
  type BusinessDeletionDynamoDbAbsenceVerifierInput,
  type BusinessDeletionDynamoDbTransactionAdapter,
  type BusinessDeletionExternalAdapter,
} from "../src/business-deletion-executor.js";
import {
  BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION,
  type BusinessDeletionExecutionPortInput,
} from "../src/business-deletion-orchestration.js";
import {
  BUSINESS_RETENTION_POLICY_VERSION,
} from "../src/business-retention-lifecycle.js";

const OWNER =
  "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const HASH_A =
  "a".repeat(64);

const HASH_B =
  "b".repeat(64);

const HASH_C =
  "c".repeat(64);

const ATTEMPT_TOKEN_DIGEST =
  "d".repeat(64);

const OPERATION_ID =
  "123e4567-e89b-42d3-a456-426614174000";

const CREATED_AT =
  "2026-08-08T16:00:00.000Z";

const VERIFIED_AT =
  "2026-08-08T16:05:00.000Z";

function dynamoComponent(
  componentId:
    string,
  role:
    | "ciphertext-primary"
    | "primary-index"
    | "derived-index" =
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
      components:
        readonly BusinessDeletionComponentInput[];
      legalHoldStatus:
        "inactive" |
        "active";
      legalHoldVersion:
        number;
    }> = {},
): BusinessDeletionManifest {
  return createBusinessDeletionManifest({
    operationId:
      OPERATION_ID,
    authorizedOwnerPartitionKey:
      OWNER,
    targetOwnerPartitionKey:
      OWNER,
    recordType:
      "banking-instrument",
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
        input.legalHoldStatus ??
        "inactive",
      authority:
        "compliance-control",
      version:
        input.legalHoldVersion ??
        7,
      observedAt:
        CREATED_AT,
      evidenceReferenceHash:
        HASH_C,
    },
    createdAt:
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

function executableSteps(
  value:
    BusinessDeletionManifest,
): readonly BusinessDeletionExecutionStep[] {
  const plan =
    planBusinessDeletionExecution(
      value,
    );

  if (
    plan.mode ===
    "blocked-legal-hold"
  ) {
    throw new Error(
      "Expected executable plan.",
    );
  }

  return plan.steps;
}

function portInput(
  value:
    BusinessDeletionManifest,
  step:
    BusinessDeletionExecutionStep,
  stepIndex =
    1,
): BusinessDeletionExecutionPortInput {
  return {
    schemaVersion:
      BUSINESS_DELETION_ORCHESTRATION_SCHEMA_VERSION,
    operationId:
      value.operationId,
    manifestIntegrityDigest:
      value.manifestIntegrityDigest,
    stepIndex,
    step,
    attemptTokenDigest:
      ATTEMPT_TOKEN_DIGEST,
    attemptNumber:
      1,
  };
}

function adapters() {
  const dynamoExecute =
    vi.fn()
      .mockImplementation(
        async (
          input:
            BusinessDeletionDynamoDbTransactionAdapterInput,
        ) => ({
          outcome:
            "transaction-accepted",
          operationId:
            OPERATION_ID,
          manifestIntegrityDigest:
            input.manifestIntegrityDigest,
          stepIndex:
            input.stepIndex,
          stepId:
            input.stepId,
          attemptTokenDigest:
            input.attemptTokenDigest,
          componentIds:
            input.targets.map(
              (
                target,
              ) =>
                target.componentId,
            ),
          awsAccountId:
            input.targets[0]!.awsAccountId,
          awsRegion:
            input.targets[0]!.awsRegion,
          transactionRequestDigest:
            input.transactionRequestDigest,
          acceptedAt:
            VERIFIED_AT,
        }),
      );

  const verifyAbsent =
    vi.fn()
      .mockImplementation(
        async (
          input:
            {
              operationId:
                string;
              manifestIntegrityDigest:
                string;
              stepIndex:
                number;
              stepId:
                string;
              attemptTokenDigest:
                string;
              targets:
                readonly {
                  componentId:
                    string;
                  awsAccountId:
                    string;
                  awsRegion:
                    string;
                }[];
              transactionReceipt:
                {
                  transactionRequestDigest:
                    string;
                };
            },
        ) => ({
          outcome:
            "absence-verified",
          operationId:
            input.operationId,
          manifestIntegrityDigest:
            input.manifestIntegrityDigest,
          stepIndex:
            input.stepIndex,
          stepId:
            input.stepId,
          attemptTokenDigest:
            input.attemptTokenDigest,
          componentIds:
            input.targets.map(
              (target) =>
                target.componentId,
            ),
          awsAccountId:
            input.targets[0]!.awsAccountId,
          awsRegion:
            input.targets[0]!.awsRegion,
          transactionRequestDigest:
            input.transactionReceipt.transactionRequestDigest,
          verifiedAt:
            VERIFIED_AT,
        }),
      );

  const externalExecute =
    vi.fn()
      .mockImplementation(
        async (
          input:
            {
              target:
                {
                  componentId:
                    string;
                };
            },
        ) => ({
          outcome:
            "verified-complete",
          completedComponentIds: [
            input.target.componentId,
          ],
          verifiedAt:
            VERIFIED_AT,
        }),
      );

  return {
    dynamoExecute,
    verifyAbsent,
    externalExecute,
    dynamoDbAdapter: {
      execute:
        dynamoExecute,
    } as BusinessDeletionDynamoDbTransactionAdapter,
    dynamoDbAbsenceVerifier: {
      verifyAbsent,
    } as BusinessDeletionAbsenceVerifier,
    externalAdapter: {
      execute:
        externalExecute,
    } as BusinessDeletionExternalAdapter,
  };
}

describe(
  "manifest-bound business deletion executor contracts",
  () => {
    it(
      "publishes a contract-only boundary with no concrete deletion capability",
      () => {
        expect(
          BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
        ).toBe(2);

        expect(
          BUSINESS_DELETION_EXECUTOR_BOUNDARY,
        ).toEqual({
          manifestBinding:
            "construction-time-exact-manifest",
          manifestIntegrityBinding:
            "exact-digest",
          operationBinding:
            "exact-operation-id",
          orchestrationInput:
            "sanitized-step-only",
          rawLocatorResolution:
            "executor-boundary-only",
          dynamoDbAdapter:
            "transaction-receipt-contract-only",
          dynamoDbAbsenceVerifier:
            "independent-read-only-contract-only",
          externalAdapter:
            "dependency-injected-contract-only",
          adapterCompletion:
            "receipt-plus-absence-verification",
          persistence:
            false,
          logging:
            false,
          awsSdk:
            false,
          actualBusinessDelete:
            false,
          handlerWiring:
            false,
          api:
            false,
          queue:
            false,
          worker:
            false,
          infrastructureChange:
            false,
        });
      },
    );

    it(
      "resolves only the planned DynamoDB component IDs to exact manifest-bound keys",
      async () => {
        const value =
          manifest();

        const step =
          executableSteps(
            value,
          )[0];

        expect(step).toBeDefined();
        expect(step!.kind).toBe(
          "dynamodb-transaction",
        );

        const fixture =
          adapters();

        const port =
          createManifestBoundBusinessDeletionExecutionPort(
            value,
            {
              dynamoDbAdapter:
                fixture.dynamoDbAdapter,
              dynamoDbAbsenceVerifier:
                fixture.dynamoDbAbsenceVerifier,
              externalAdapter:
                fixture.externalAdapter,
            },
          );

        await expect(
          port.executeStep(
            portInput(
              value,
              step!,
            ),
          ),
        ).resolves.toEqual({
          outcome:
            "verified-complete",
          completedComponentIds:
            step!.componentIds,
          verifiedAt:
            VERIFIED_AT,
        });

        expect(
          fixture.dynamoExecute,
        ).toHaveBeenCalledTimes(1);

        expect(
          fixture.externalExecute,
        ).not.toHaveBeenCalled();

        expect(
          fixture.dynamoExecute,
        ).toHaveBeenCalledWith({
          schemaVersion:
            BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
          operationId:
            OPERATION_ID,
          manifestIntegrityDigest:
            value.manifestIntegrityDigest,
          stepIndex:
            1,
          stepId:
            step!.stepId,
          attemptTokenDigest:
            ATTEMPT_TOKEN_DIGEST,
          attemptNumber:
            1,
          requiredLegalHoldVersion:
            7,
          targets: [
            {
              componentId:
                "ciphertext-primary",
              tableRole:
                "business-table",
              awsAccountId:
                "123456789012",
              awsRegion:
                "us-east-1",
              partitionKey:
                OWNER,
              sortKey:
                "BUSINESS#SENSITIVE#ciphertext-primary",
            },
            {
              componentId:
                "derived-index-01",
              tableRole:
                "business-table",
              awsAccountId:
                "123456789012",
              awsRegion:
                "us-east-1",
              partitionKey:
                OWNER,
              sortKey:
                "BUSINESS#SENSITIVE#derived-index-01",
            },
          ],
          transactionRequestDigest:
            expect.stringMatching(
              /^[a-f0-9]{64}$/,
            ),
        });

        expect(
          fixture.verifyAbsent,
        ).toHaveBeenCalledTimes(1);
      },
    );

    it(
      "resolves an external reference only inside the injected external adapter boundary",
      async () => {
        const value =
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
          });

        const steps =
          executableSteps(
            value,
          );

        const externalStep =
          steps.find(
            (
              step,
            ) =>
              step.kind ===
              "external-verified-step",
          );

        expect(
          externalStep,
        ).toBeDefined();

        const fixture =
          adapters();

        const port =
          createManifestBoundBusinessDeletionExecutionPort(
            value,
            {
              dynamoDbAdapter:
                fixture.dynamoDbAdapter,
              dynamoDbAbsenceVerifier:
                fixture.dynamoDbAbsenceVerifier,
              externalAdapter:
                fixture.externalAdapter,
            },
          );

        const stepIndex =
          steps.indexOf(
            externalStep!,
          ) + 1;

        await expect(
          port.executeStep(
            portInput(
              value,
              externalStep!,
              stepIndex,
            ),
          ),
        ).resolves.toEqual({
          outcome:
            "verified-complete",
          completedComponentIds: [
            "external-copy-01",
          ],
          verifiedAt:
            VERIFIED_AT,
        });

        expect(
          fixture.externalExecute,
        ).toHaveBeenCalledWith({
          schemaVersion:
            BUSINESS_DELETION_EXECUTOR_CONTRACT_SCHEMA_VERSION,
          operationId:
            OPERATION_ID,
          manifestIntegrityDigest:
            value.manifestIntegrityDigest,
          stepIndex,
          stepId:
            externalStep!.stepId,
          attemptTokenDigest:
            ATTEMPT_TOKEN_DIGEST,
          attemptNumber:
            1,
          requiredLegalHoldVersion:
            7,
          target: {
            componentId:
              "external-copy-01",
            systemRole:
              "object-store",
            referenceDigest:
              HASH_C,
          },
        });
      },
    );

    it(
      "binds execution to the exact operation and manifest digest before invoking an adapter",
      async () => {
        const value =
          manifest();

        const step =
          executableSteps(
            value,
          )[0]!;

        const fixture =
          adapters();

        const port =
          createManifestBoundBusinessDeletionExecutionPort(
            value,
            {
              dynamoDbAdapter:
                fixture.dynamoDbAdapter,
              dynamoDbAbsenceVerifier:
                fixture.dynamoDbAbsenceVerifier,
              externalAdapter:
                fixture.externalAdapter,
            },
          );

        await expect(
          port.executeStep({
            ...portInput(
              value,
              step,
            ),
            operationId:
              "223e4567-e89b-42d3-a456-426614174000",
          }),
        ).rejects.toThrow(
          "Deletion executor refused: operation does not match the bound manifest.",
        );

        await expect(
          port.executeStep({
            ...portInput(
              value,
              step,
            ),
            manifestIntegrityDigest:
              HASH_C,
          }),
        ).rejects.toThrow(
          "Deletion executor refused: manifest digest does not match the bound manifest.",
        );

        expect(
          fixture.dynamoExecute,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects unknown and duplicate requested component IDs before adapter execution",
      async () => {
        const value =
          manifest();

        const step =
          executableSteps(
            value,
          )[0];

        expect(
          step?.kind,
        ).toBe(
          "dynamodb-transaction",
        );

        if (
          !step ||
          step.kind !==
            "dynamodb-transaction"
        ) {
          throw new Error(
            "Expected DynamoDB step.",
          );
        }

        const fixture =
          adapters();

        const port =
          createManifestBoundBusinessDeletionExecutionPort(
            value,
            {
              dynamoDbAdapter:
                fixture.dynamoDbAdapter,
              dynamoDbAbsenceVerifier:
                fixture.dynamoDbAbsenceVerifier,
              externalAdapter:
                fixture.externalAdapter,
            },
          );

        await expect(
          port.executeStep(
            portInput(
              value,
              {
                ...step,
                componentIds: [
                  "missing-component",
                ],
                componentDeleteCount:
                  1,
                transactionActionCount:
                  3,
                estimatedItemBytes:
                  1024,
              },
            ),
          ),
        ).rejects.toThrow(
          "Deletion executor refused: requested component is not present in the bound manifest.",
        );

        await expect(
          port.executeStep(
            portInput(
              value,
              {
                ...step,
                componentIds: [
                  "ciphertext-primary",
                  "ciphertext-primary",
                ],
                componentDeleteCount:
                  2,
                transactionActionCount:
                  4,
                estimatedItemBytes:
                  2048,
              },
            ),
          ),
        ).rejects.toThrow(
          "Deletion executor refused: requested component identifiers contain duplicates.",
        );

        expect(
          fixture.dynamoExecute,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects step-kind and external-system-role locator mismatches",
      async () => {
        const value =
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
          });

        const steps =
          executableSteps(
            value,
          );

        const dynamoStep =
          steps.find(
            (
              step,
            ) =>
              step.kind ===
              "dynamodb-transaction",
          );

        const externalStep =
          steps.find(
            (
              step,
            ) =>
              step.kind ===
              "external-verified-step",
          );

        if (
          !dynamoStep ||
          dynamoStep.kind !==
            "dynamodb-transaction" ||
          !externalStep ||
          externalStep.kind !==
            "external-verified-step"
        ) {
          throw new Error(
            "Expected both deletion step kinds.",
          );
        }

        const fixture =
          adapters();

        const port =
          createManifestBoundBusinessDeletionExecutionPort(
            value,
            {
              dynamoDbAdapter:
                fixture.dynamoDbAdapter,
              dynamoDbAbsenceVerifier:
                fixture.dynamoDbAbsenceVerifier,
              externalAdapter:
                fixture.externalAdapter,
            },
          );

        await expect(
          port.executeStep(
            portInput(
              value,
              {
                ...dynamoStep,
                componentIds: [
                  "external-copy-01",
                ],
                componentDeleteCount:
                  1,
                transactionActionCount:
                  3,
                estimatedItemBytes:
                  0,
              },
            ),
          ),
        ).rejects.toThrow(
          "Deletion executor refused: DynamoDB step contains a non-DynamoDB component.",
        );

        await expect(
          port.executeStep(
            portInput(
              value,
              {
                ...externalStep,
                systemRole:
                  "provider",
              },
              2,
            ),
          ),
        ).rejects.toThrow(
          "Deletion executor refused: external target system role does not match the planned step.",
        );
      },
    );

    it(
      "rejects DynamoDB account, Region, component-count, action-count, and byte-budget drift",
      async () => {
        const value =
          manifest();

        const step =
          executableSteps(
            value,
          )[0];

        if (
          !step ||
          step.kind !==
            "dynamodb-transaction"
        ) {
          throw new Error(
            "Expected DynamoDB step.",
          );
        }

        const fixture =
          adapters();

        const port =
          createManifestBoundBusinessDeletionExecutionPort(
            value,
            {
              dynamoDbAdapter:
                fixture.dynamoDbAdapter,
              dynamoDbAbsenceVerifier:
                fixture.dynamoDbAbsenceVerifier,
              externalAdapter:
                fixture.externalAdapter,
            },
          );

        const cases:
          readonly [
            Partial<
              typeof step
            >,
            string,
          ][] = [
            [
              {
                awsAccountId:
                  "999999999999",
              },
              "DynamoDB target AWS account does not match the planned step.",
            ],
            [
              {
                awsRegion:
                  "us-west-2",
              },
              "DynamoDB target AWS Region does not match the planned step.",
            ],
            [
              {
                componentDeleteCount:
                  1,
              },
              "DynamoDB step component count does not match the bound manifest.",
            ],
            [
              {
                transactionActionCount:
                  99,
              },
              "DynamoDB step transaction action count is invalid.",
            ],
            [
              {
                estimatedItemBytes:
                  step.estimatedItemBytes +
                  1,
              },
              "DynamoDB step byte estimate does not match the bound manifest.",
            ],
          ];

        for (
          const [
            override,
            message,
          ] of cases
        ) {
          await expect(
            port.executeStep(
              portInput(
                value,
                {
                  ...step,
                  ...override,
                },
              ),
            ),
          ).rejects.toThrow(
            `Deletion executor refused: ${message}`,
          );
        }

        expect(
          fixture.dynamoExecute,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "fails closed on active or version-drifted legal hold state",
      async () => {
        const inactive =
          manifest();

        const step =
          executableSteps(
            inactive,
          )[0]!;

        const fixture =
          adapters();

        const port =
          createManifestBoundBusinessDeletionExecutionPort(
            inactive,
            {
              dynamoDbAdapter:
                fixture.dynamoDbAdapter,
              dynamoDbAbsenceVerifier:
                fixture.dynamoDbAbsenceVerifier,
              externalAdapter:
                fixture.externalAdapter,
            },
          );

        await expect(
          port.executeStep(
            portInput(
              inactive,
              {
                ...step,
                requiredLegalHoldVersion:
                  8,
              },
            ),
          ),
        ).rejects.toThrow(
          "Deletion executor refused: step legal-hold version does not match the bound manifest.",
        );

        const active =
          manifest({
            legalHoldStatus:
              "active",
          });

        const activeFixture =
          adapters();

        const activePort =
          createManifestBoundBusinessDeletionExecutionPort(
            active,
            {
              dynamoDbAdapter:
                activeFixture
                  .dynamoDbAdapter,
              dynamoDbAbsenceVerifier:
                activeFixture
                  .dynamoDbAbsenceVerifier,
              externalAdapter:
                activeFixture
                  .externalAdapter,
            },
          );

        const inactiveStep =
          executableSteps(
            inactive,
          )[0]!;

        await expect(
          activePort.executeStep({
            ...portInput(
              inactive,
              inactiveStep,
            ),
            operationId:
              active.operationId,
            manifestIntegrityDigest:
              active.manifestIntegrityDigest,
          }),
        ).rejects.toThrow(
          "Deletion executor refused: bound manifest is blocked by an active legal hold.",
        );

        expect(
          fixture.dynamoExecute,
        ).not.toHaveBeenCalled();

        expect(
          activeFixture.dynamoExecute,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "fails closed on unknown, missing, duplicate, or mismatched transaction receipts",
      async () => {
        const value = manifest();
        const step = executableSteps(value)[0]!;

        const receiptOverrides = [
          { outcome: "verified-complete" },
          { operationId: undefined },
          { manifestIntegrityDigest: HASH_C },
          { stepIndex: 2 },
          { stepId: "wrong-step" },
          { attemptTokenDigest: HASH_C },
          { componentIds: ["ciphertext-primary"] },
          {
            componentIds: [
              "ciphertext-primary",
              "ciphertext-primary",
            ],
          },
          { awsAccountId: "999999999999" },
          { awsRegion: "us-west-2" },
          { transactionRequestDigest: HASH_C },
          { acceptedAt: "2026-08-08 16:05:00Z" },
        ] as const;

        for (const override of receiptOverrides) {
          const verifyAbsent = vi.fn();
          const transactionAdapter = {
            execute: vi.fn().mockImplementation(
              async (input: BusinessDeletionDynamoDbTransactionAdapterInput) => ({
                outcome: "transaction-accepted",
                operationId: input.operationId,
                manifestIntegrityDigest:
                  input.manifestIntegrityDigest,
                stepIndex: input.stepIndex,
                stepId: input.stepId,
                attemptTokenDigest:
                  input.attemptTokenDigest,
                componentIds: input.targets.map(
                  (target) => target.componentId,
                ),
                awsAccountId: input.targets[0]!.awsAccountId,
                awsRegion: input.targets[0]!.awsRegion,
                transactionRequestDigest:
                  input.transactionRequestDigest,
                acceptedAt: VERIFIED_AT,
                ...override,
              }),
            ),
          } as BusinessDeletionDynamoDbTransactionAdapter;

          const port =
            createManifestBoundBusinessDeletionExecutionPort(
              value,
              {
                dynamoDbAdapter: transactionAdapter,
                dynamoDbAbsenceVerifier: {
                  verifyAbsent,
                } as BusinessDeletionAbsenceVerifier,
                externalAdapter: {
                  execute: vi.fn(),
                } as BusinessDeletionExternalAdapter,
              },
            );

          await expect(
            port.executeStep(portInput(value, step)),
          ).rejects.toThrow(/Deletion executor refused:/);
          expect(verifyAbsent).not.toHaveBeenCalled();
        }
      },
    );

    it(
      "produces verified-complete only from exact independent absence evidence",
      async () => {
        const value = manifest();
        const step = executableSteps(value)[0]!;

        const verificationOverrides = [
          { outcome: "transaction-accepted" },
          { operationId: undefined },
          { manifestIntegrityDigest: HASH_C },
          { stepIndex: 2 },
          { stepId: "wrong-step" },
          { attemptTokenDigest: HASH_C },
          { componentIds: ["ciphertext-primary"] },
          {
            componentIds: [
              "ciphertext-primary",
              "ciphertext-primary",
            ],
          },
          { awsAccountId: "999999999999" },
          { awsRegion: "us-west-2" },
          { transactionRequestDigest: HASH_C },
          { verifiedAt: "2026-08-08 16:05:00Z" },
        ] as const;

        for (const override of verificationOverrides) {
          const fixture = adapters();
          fixture.verifyAbsent.mockImplementationOnce(
            async (
              input:
                BusinessDeletionDynamoDbAbsenceVerifierInput,
            ) => ({
              outcome: "absence-verified",
              operationId: input.operationId,
              manifestIntegrityDigest:
                input.manifestIntegrityDigest,
              stepIndex: input.stepIndex,
              stepId: input.stepId,
              attemptTokenDigest:
                input.attemptTokenDigest,
              componentIds: input.targets.map(
                (target) => target.componentId,
              ),
              awsAccountId: input.targets[0]!.awsAccountId,
              awsRegion: input.targets[0]!.awsRegion,
              transactionRequestDigest:
                input.transactionReceipt.transactionRequestDigest,
              verifiedAt: VERIFIED_AT,
              ...override,
            }),
          );

          const port =
            createManifestBoundBusinessDeletionExecutionPort(
              value,
              {
                dynamoDbAdapter: fixture.dynamoDbAdapter,
                dynamoDbAbsenceVerifier:
                  fixture.dynamoDbAbsenceVerifier,
                externalAdapter: fixture.externalAdapter,
              },
            );

          await expect(
            port.executeStep(portInput(value, step)),
          ).rejects.toThrow(/Deletion executor refused:/);
        }
      },
    );

    it(
      "requires explicit injected adapters and never widens the orchestration port with raw locators",
      () => {
        const value =
          manifest();

        expect(
          () =>
            createManifestBoundBusinessDeletionExecutionPort(
              value,
              {
                dynamoDbAdapter:
                  null,
                dynamoDbAbsenceVerifier:
                  null,
                externalAdapter:
                  null,
              } as unknown as {
                dynamoDbAdapter:
                  BusinessDeletionDynamoDbTransactionAdapter;
                dynamoDbAbsenceVerifier:
                  BusinessDeletionAbsenceVerifier;
                externalAdapter:
                  BusinessDeletionExternalAdapter;
              },
            ),
        ).toThrow(
          "Deletion executor refused: explicit deletion adapter dependencies are required.",
        );

        const orchestrationSource =
          readFileSync(
            new URL(
              "../src/business-deletion-orchestration.ts",
              import.meta.url,
            ),
            "utf8",
          );

        expect(
          orchestrationSource,
        ).not.toContain(
          "partitionKey",
        );

        expect(
          orchestrationSource,
        ).not.toContain(
          "sortKey",
        );

        expect(
          orchestrationSource,
        ).not.toContain(
          "referenceDigest",
        );
      },
    );

    it(
      "keeps the executor contract free of AWS SDK, persistence, logging, environment, handler, runtime, and concrete delete wiring",
      () => {
        const source =
          readFileSync(
            new URL(
              "../src/business-deletion-executor.ts",
              import.meta.url,
            ),
            "utf8",
          );

        for (
          const forbidden of
          [
            "@aws-sdk/",
            "DynamoDBClient",
            "DeleteItemCommand",
            "TransactWriteItemsCommand",
            "QueryCommand",
            "ScanCommand",
            "BatchWrite",
            "process.env",
            "console.",
            "business-runtime",
            "./handler",
            "BusinessDeletionOrchestrationPersistence",
            "DELETION_CONTROL_TABLE_NAME",
            "BUSINESS_TABLE_NAME",
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
          "partitionKey",
        );

        expect(
          source,
        ).toContain(
          "sortKey",
        );

        expect(
          source,
        ).toContain(
          "referenceDigest",
        );
      },
    );
  },
);
