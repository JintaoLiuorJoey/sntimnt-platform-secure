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
  BUSINESS_ITEM_GENERATION_BOUNDARY,
  BUSINESS_ITEM_GENERATION_ENTROPY_BYTES,
  BUSINESS_ITEM_GENERATION_SCHEMA_VERSION,
  BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION,
  assertBusinessItemGenerationImmutable,
  createBusinessDeletionDynamoDbLocatorFromTrustedGeneration,
  createBusinessItemGenerationAtomicCreateContract,
  createBusinessItemGenerationLegacyMigrationContract,
  createBusinessItemGenerationUpdateContract,
  resolveBusinessItemGenerationForDeletion,
  resolveBusinessItemGenerationWriterEnforcement,
  type BusinessItemGenerationReader,
  type BusinessItemGenerationReadyResolution,
} from "../src/business-item-generation.js";

const OWNER =
  "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const SORT_KEY =
  "BUSINESS#SENSITIVE#ciphertext-primary";

const HASH_A =
  "a".repeat(64);

const HASH_B =
  "b".repeat(64);

function key() {
  return {
    partitionKey:
      OWNER,
    sortKey:
      SORT_KEY,
  } as const;
}

function readerResult(
  value:
    | "present"
    | "legacy-missing-generation"
    | "absent" =
      "present",
): BusinessItemGenerationReader {
  return {
    readGeneration:
      vi.fn()
        .mockResolvedValue(
          value === "present"
            ? {
                source:
                  "business-table-generation-read",
                consistency:
                  "strongly-consistent",
                outcome:
                  "present",
                partitionKey:
                  OWNER,
                sortKey:
                  SORT_KEY,
                deletionGuardDigest:
                  HASH_A,
              }
            : {
                source:
                  "business-table-generation-read",
                consistency:
                  "strongly-consistent",
                outcome:
                  value,
                partitionKey:
                  OWNER,
                sortKey:
                  SORT_KEY,
              },
        ),
  };
}

describe(
  "business item generation lifecycle contracts",
  () => {
    it(
      "publishes the reviewed generation lifecycle boundary",
      () => {
        expect(
          BUSINESS_ITEM_GENERATION_SCHEMA_VERSION,
        ).toBe(1);

        expect(
          BUSINESS_ITEM_GENERATION_ENTROPY_BYTES,
        ).toBe(32);

        expect(
          BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION,
        ).toBe(1);

        expect(
          BUSINESS_ITEM_GENERATION_BOUNDARY,
        ).toEqual({
          generation:
            "server-csprng-256-bit",
          createPersistence:
            "same-item-atomic-create-only",
          updatePolicy:
            "generation-immutable",
          sameKeyRecreation:
            "new-generation-required",
          deletionLocatorSource:
            "trusted-strongly-consistent-read-only",
          legacyMigration:
            "writer-enforcement-before-conditional-backfill",
          migrationCompletion:
            "strongly-consistent-reread-before-manifest",
          persistence:
            false,
          awsSdk:
            false,
          environment:
            false,
          handlerWiring:
            false,
          infrastructureChange:
            false,
        });
      },
    );

    it(
      "issues canonical 256-bit server generations and binds them to atomic create requests",
      () => {
        const observed =
          new Set<string>();

        for (
          let index = 0;
          index < 64;
          index++
        ) {
          const contract =
            createBusinessItemGenerationAtomicCreateContract({
              key:
                key(),
              itemPayloadDigest:
                HASH_A,
            });

          expect(
            contract,
          ).toMatchObject({
            schemaVersion:
              1,
            mode:
              "atomic-create-with-generation",
            key:
              key(),
            itemPayloadDigest:
              HASH_A,
            supersededGenerationDigest:
              null,
            atomicity:
              "item-and-generation-single-write",
            condition: {
              kind:
                "key-absent",
              partitionKeyAttributeName:
                "pk",
              sortKeyAttributeName:
                "sk",
            },
          });

          expect(
            contract.deletionGuardDigest,
          ).toMatch(
            /^[a-f0-9]{64}$/,
          );

          expect(
            contract.requestDigest,
          ).toMatch(
            /^[a-f0-9]{64}$/,
          );

          expect(
            observed.has(
              contract.deletionGuardDigest,
            ),
          ).toBe(false);

          observed.add(
            contract.deletionGuardDigest,
          );

          expect(
            Object.isFrozen(
              contract,
            ),
          ).toBe(true);
        }
      },
    );

    it(
      "requires a new generation when the same key is recreated",
      () => {
        const contract =
          createBusinessItemGenerationAtomicCreateContract({
            key:
              key(),
            itemPayloadDigest:
              HASH_A,
            supersededGenerationDigest:
              HASH_B,
          });

        expect(
          contract.supersededGenerationDigest,
        ).toBe(
          HASH_B,
        );

        expect(
          contract.deletionGuardDigest,
        ).not.toBe(
          HASH_B,
        );
      },
    );

    it(
      "binds atomic create requests to exact item content and rejects malformed inputs",
      () => {
        const first =
          createBusinessItemGenerationAtomicCreateContract({
            key:
              key(),
            itemPayloadDigest:
              HASH_A,
          });

        const second =
          createBusinessItemGenerationAtomicCreateContract({
            key:
              key(),
            itemPayloadDigest:
              HASH_B,
          });

        expect(
          second.requestDigest,
        ).not.toBe(
          first.requestDigest,
        );

        expect(
          () =>
            createBusinessItemGenerationAtomicCreateContract({
              key: {
                partitionKey:
                  " bad-key",
                sortKey:
                  SORT_KEY,
              },
              itemPayloadDigest:
                HASH_A,
            }),
        ).toThrow(
          "Business item partition key is invalid.",
        );

        expect(
          () =>
            createBusinessItemGenerationAtomicCreateContract({
              key:
                key(),
              itemPayloadDigest:
                "not-a-digest",
            }),
        ).toThrow(
          "Business item payload must be a lowercase SHA-256 digest.",
        );
      },
    );

    it(
      "makes the generation immutable for in-place updates",
      () => {
        expect(
          assertBusinessItemGenerationImmutable(
            HASH_A,
            HASH_A,
          ),
        ).toBe(
          HASH_A,
        );

        for (
          const proposed of
          [
            HASH_B,
            null,
            undefined,
          ]
        ) {
          expect(
            () =>
              assertBusinessItemGenerationImmutable(
                HASH_A,
                proposed,
              ),
          ).toThrow(
            "Business item generation is immutable for the lifetime of an item.",
          );
        }

        const contract =
          createBusinessItemGenerationUpdateContract({
            key:
              key(),
            itemPayloadDigest:
              HASH_B,
            currentGenerationDigest:
              HASH_A,
            proposedGenerationDigest:
              HASH_A,
          });

        expect(
          contract,
        ).toMatchObject({
          mode:
            "update-preserving-generation",
          deletionGuardDigest:
            HASH_A,
          generationMutation:
            "forbidden",
          condition: {
            kind:
              "generation-equals",
            generationAttributeName:
              "deletionGuardDigest",
            expectedGenerationDigest:
              HASH_A,
          },
        });
      },
    );

    it(
      "creates a deletion locator only from an exact strongly consistent generation read",
      async () => {
        const reader =
          readerResult();

        const resolution =
          await resolveBusinessItemGenerationForDeletion(
            reader,
            key(),
          );

        expect(
          resolution,
        ).toMatchObject({
          outcome:
            "ready-for-deletion-manifest",
          key:
            key(),
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
              HASH_A,
          },
        });

        if (
          resolution.outcome !==
          "ready-for-deletion-manifest"
        ) {
          throw new Error(
            "Expected ready resolution.",
          );
        }

        const locator =
          createBusinessDeletionDynamoDbLocatorFromTrustedGeneration(
            resolution,
            {
              awsAccountId:
                "123456789012",
              awsRegion:
                "us-east-1",
              estimatedItemBytes:
                1024,
            },
          );

        expect(
          locator,
        ).toEqual({
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
            SORT_KEY,
          itemGenerationPrecondition:
            resolution.itemGenerationPrecondition,
          estimatedItemBytes:
            1024,
        });

        expect(
          reader.readGeneration,
        ).toHaveBeenCalledWith(
          key(),
        );
      },
    );

    it(
      "rejects forged ready resolutions before constructing a deletion locator",
      () => {
        const forged = {
          outcome:
            "ready-for-deletion-manifest",
          key:
            key(),
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
              HASH_A,
          },
          observationDigest:
            HASH_B,
        } as BusinessItemGenerationReadyResolution;

        expect(
          () =>
            createBusinessDeletionDynamoDbLocatorFromTrustedGeneration(
              forged,
              {
                awsAccountId:
                  "123456789012",
                awsRegion:
                  "us-east-1",
                estimatedItemBytes:
                  1024,
              },
            ),
        ).toThrow(
          "Deletion locators require a trusted strongly consistent item-generation observation.",
        );
      },
    );

    it(
      "fails closed on untrusted, eventual, drifted, and malformed generation observations",
      async () => {
        const invalidResults = [
          null,
          {
            source:
              "caller-input",
            consistency:
              "strongly-consistent",
            outcome:
              "present",
            partitionKey:
              OWNER,
            sortKey:
              SORT_KEY,
            deletionGuardDigest:
              HASH_A,
          },
          {
            source:
              "business-table-generation-read",
            consistency:
              "eventual",
            outcome:
              "present",
            partitionKey:
              OWNER,
            sortKey:
              SORT_KEY,
            deletionGuardDigest:
              HASH_A,
          },
          {
            source:
              "business-table-generation-read",
            consistency:
              "strongly-consistent",
            outcome:
              "present",
            partitionKey:
              OWNER,
            sortKey:
              "BUSINESS#SENSITIVE#replacement",
            deletionGuardDigest:
              HASH_A,
          },
          {
            source:
              "business-table-generation-read",
            consistency:
              "strongly-consistent",
            outcome:
              "unknown",
            partitionKey:
              OWNER,
            sortKey:
              SORT_KEY,
          },
        ];

        for (
          const result of
          invalidResults
        ) {
          await expect(
            resolveBusinessItemGenerationForDeletion(
              {
                readGeneration:
                  vi.fn()
                    .mockResolvedValue(
                      result,
                    ),
              } as unknown as BusinessItemGenerationReader,
              key(),
            ),
          ).rejects.toThrow(
            "Business item generation observation is not trusted or does not match the requested item.",
          );
        }

        await expect(
          resolveBusinessItemGenerationForDeletion(
            {
              readGeneration:
                vi.fn()
                  .mockResolvedValue({
                    source:
                      "business-table-generation-read",
                    consistency:
                      "strongly-consistent",
                    outcome:
                      "present",
                    partitionKey:
                      OWNER,
                    sortKey:
                      SORT_KEY,
                    deletionGuardDigest:
                      "not-a-digest",
                  }),
            },
            key(),
          ),
        ).rejects.toThrow(
          "Business item generation must be a lowercase SHA-256 digest.",
        );
      },
    );

    it(
      "routes legacy items through a gated conditional migration without producing manifest input",
      async () => {
        const resolution =
          await resolveBusinessItemGenerationForDeletion(
            readerResult(
              "legacy-missing-generation",
            ),
            key(),
          );

        expect(
          resolution,
        ).toMatchObject({
          outcome:
            "migration-required",
          reason:
            "missing-deletion-guard",
          key:
            key(),
        });

        expect(
          "itemGenerationPrecondition" in
            resolution,
        ).toBe(false);

        if (
          resolution.outcome !==
          "migration-required"
        ) {
          throw new Error(
            "Expected migration resolution.",
          );
        }

        expect(
          createBusinessItemGenerationLegacyMigrationContract.bind(
            null,
            resolution,
            {
              state:
                "writer-enforcement-verified",
              version:
                1,
              inventoryDigest:
                HASH_B,
            },
          ),
        ).toThrow(
          "Legacy generation migration is blocked until all business item writers enforce generation v1.",
        );

        await expect(
          resolveBusinessItemGenerationWriterEnforcement({
            readWriterEnforcement:
              vi.fn()
                .mockResolvedValue({
                  source:
                    "business-item-writer-inventory",
                  state:
                    "partial",
                  version:
                    1,
                  inventoryDigest:
                    HASH_B,
                }),
          } as never),
        ).rejects.toThrow(
          "Business item writer generation enforcement is not trusted or incomplete.",
        );

        const writerEnforcement =
          await resolveBusinessItemGenerationWriterEnforcement({
            readWriterEnforcement:
              vi.fn()
                .mockResolvedValue({
                  source:
                    "business-item-writer-inventory",
                  state:
                    "enforced",
                  version:
                    1,
                  inventoryDigest:
                    HASH_B,
                }),
          });

        const migration =
          createBusinessItemGenerationLegacyMigrationContract(
            resolution,
            writerEnforcement,
          );

        expect(
          migration,
        ).toMatchObject({
          mode:
            "conditional-legacy-generation-backfill",
          key:
            key(),
          writerEnforcementVersion:
            1,
          writerEnforcementInventoryDigest:
            HASH_B,
          rolloutGate:
            "all-business-item-writers-enforce-generation-v1",
          condition: {
            kind:
              "item-present-and-generation-absent",
            partitionKeyAttributeName:
              "pk",
            sortKeyAttributeName:
              "sk",
            generationAttributeName:
              "deletionGuardDigest",
          },
          completionRequirement:
            "strongly-consistent-reread-before-manifest",
        });

        expect(
          migration.deletionGuardDigest,
        ).toMatch(
          /^[a-f0-9]{64}$/,
        );
      },
    );

    it(
      "does not treat an absent item as ready or migration-eligible",
      async () => {
        const resolution =
          await resolveBusinessItemGenerationForDeletion(
            readerResult(
              "absent",
            ),
            key(),
          );

        expect(
          resolution,
        ).toMatchObject({
          outcome:
            "item-absent",
          key:
            key(),
        });

        expect(
          "itemGenerationPrecondition" in
            resolution,
        ).toBe(false);

        expect(
          () =>
            createBusinessItemGenerationLegacyMigrationContract(
              resolution as never,
              {
                state:
                  "writer-enforcement-verified",
                version:
                  BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION,
                inventoryDigest:
                  HASH_B,
              } as never,
            ),
        ).toThrow(
          "Legacy generation migration requires a trusted missing-generation observation.",
        );
      },
    );

    it(
      "keeps lifecycle contracts free of AWS, persistence, logging, runtime, and deployment wiring",
      () => {
        const source =
          readFileSync(
            new URL(
              "../src/business-item-generation.ts",
              import.meta.url,
            ),
            "utf8",
          );

        for (
          const forbidden of
          [
            "@aws-sdk/",
            "DynamoDBClient",
            "PutItemCommand",
            "UpdateItemCommand",
            "TransactWriteItemsCommand",
            "process.env",
            "console.",
            "BUSINESS_TABLE_NAME",
            "./handler",
            "business-runtime",
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
          "randomBytes",
        );

        expect(
          source,
        ).toContain(
          "strongly-consistent-reread-before-manifest",
        );
      },
    );
  },
);
