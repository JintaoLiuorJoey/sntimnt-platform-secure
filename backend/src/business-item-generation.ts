import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  BUSINESS_DELETION_DYNAMODB_ITEM_GENERATION_PRECONDITION,
  type BusinessDeletionDynamoDbItemGenerationPrecondition,
  type BusinessDeletionDynamoDbLocator,
} from "./business-deletion-execution.js";

export const BUSINESS_ITEM_GENERATION_SCHEMA_VERSION =
  1 as const;

export const BUSINESS_ITEM_GENERATION_ENTROPY_BYTES =
  32 as const;

export const BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION =
  1 as const;

export const BUSINESS_ITEM_GENERATION_BOUNDARY =
  Object.freeze({
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
  } as const);

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9#:_./@+-]{0,1023}$/;

const AWS_ACCOUNT_ID_PATTERN =
  /^\d{12}$/;

const AWS_REGION_PATTERN =
  /^[a-z]{2}(?:-gov)?-[a-z]+-\d$/;

const MAX_DYNAMODB_ITEM_BYTES =
  400 * 1024;

export interface BusinessItemGenerationKey {
  readonly partitionKey:
    string;
  readonly sortKey:
    string;
}

export interface BusinessItemGenerationAtomicCreateContract {
  readonly schemaVersion:
    typeof BUSINESS_ITEM_GENERATION_SCHEMA_VERSION;
  readonly mode:
    "atomic-create-with-generation";
  readonly key:
    BusinessItemGenerationKey;
  readonly itemPayloadDigest:
    string;
  readonly deletionGuardDigest:
    string;
  readonly supersededGenerationDigest:
    string | null;
  readonly atomicity:
    "item-and-generation-single-write";
  readonly condition:
    Readonly<{
      kind:
        "key-absent";
      partitionKeyAttributeName:
        "pk";
      sortKeyAttributeName:
        "sk";
    }>;
  readonly requestDigest:
    string;
}

export interface BusinessItemGenerationUpdateContract {
  readonly schemaVersion:
    typeof BUSINESS_ITEM_GENERATION_SCHEMA_VERSION;
  readonly mode:
    "update-preserving-generation";
  readonly key:
    BusinessItemGenerationKey;
  readonly itemPayloadDigest:
    string;
  readonly deletionGuardDigest:
    string;
  readonly generationMutation:
    "forbidden";
  readonly condition:
    Readonly<{
      kind:
        "generation-equals";
      generationAttributeName:
        "deletionGuardDigest";
      expectedGenerationDigest:
        string;
    }>;
  readonly requestDigest:
    string;
}

interface BusinessItemGenerationObservationBase {
  readonly source:
    "business-table-generation-read";
  readonly consistency:
    "strongly-consistent";
  readonly partitionKey:
    string;
  readonly sortKey:
    string;
}

export interface BusinessItemGenerationPresentObservation
  extends BusinessItemGenerationObservationBase {
  readonly outcome:
    "present";
  readonly deletionGuardDigest:
    string;
}

export interface BusinessItemGenerationLegacyObservation
  extends BusinessItemGenerationObservationBase {
  readonly outcome:
    "legacy-missing-generation";
}

export interface BusinessItemGenerationAbsentObservation
  extends BusinessItemGenerationObservationBase {
  readonly outcome:
    "absent";
}

export type BusinessItemGenerationReadResult =
  | BusinessItemGenerationPresentObservation
  | BusinessItemGenerationLegacyObservation
  | BusinessItemGenerationAbsentObservation;

export interface BusinessItemGenerationReader {
  readGeneration(
    key:
      Readonly<BusinessItemGenerationKey>,
  ): Promise<
    Readonly<BusinessItemGenerationReadResult>
  >;
}

export interface BusinessItemGenerationWriterEnforcementAuthority {
  readWriterEnforcement(): Promise<
    Readonly<{
      source:
        "business-item-writer-inventory";
      state:
        "enforced";
      version:
        typeof BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION;
      inventoryDigest:
        string;
    }>
  >;
}

export interface BusinessItemGenerationWriterEnforcementResolution {
  readonly state:
    "writer-enforcement-verified";
  readonly version:
    typeof BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION;
  readonly inventoryDigest:
    string;
}

export interface BusinessItemGenerationReadyResolution {
  readonly outcome:
    "ready-for-deletion-manifest";
  readonly key:
    BusinessItemGenerationKey;
  readonly itemGenerationPrecondition:
    BusinessDeletionDynamoDbItemGenerationPrecondition;
  readonly observationDigest:
    string;
}

export interface BusinessItemGenerationMigrationRequiredResolution {
  readonly outcome:
    "migration-required";
  readonly key:
    BusinessItemGenerationKey;
  readonly reason:
    "missing-deletion-guard";
  readonly observationDigest:
    string;
}

export interface BusinessItemGenerationAbsentResolution {
  readonly outcome:
    "item-absent";
  readonly key:
    BusinessItemGenerationKey;
  readonly observationDigest:
    string;
}

export type BusinessItemGenerationResolution =
  | BusinessItemGenerationReadyResolution
  | BusinessItemGenerationMigrationRequiredResolution
  | BusinessItemGenerationAbsentResolution;

export interface BusinessItemGenerationLegacyMigrationContract {
  readonly schemaVersion:
    typeof BUSINESS_ITEM_GENERATION_SCHEMA_VERSION;
  readonly mode:
    "conditional-legacy-generation-backfill";
  readonly key:
    BusinessItemGenerationKey;
  readonly deletionGuardDigest:
    string;
  readonly observationDigest:
    string;
  readonly writerEnforcementVersion:
    typeof BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION;
  readonly writerEnforcementInventoryDigest:
    string;
  readonly rolloutGate:
    "all-business-item-writers-enforce-generation-v1";
  readonly condition:
    Readonly<{
      kind:
        "item-present-and-generation-absent";
      partitionKeyAttributeName:
        "pk";
      sortKeyAttributeName:
        "sk";
      generationAttributeName:
        "deletionGuardDigest";
    }>;
  readonly completionRequirement:
    "strongly-consistent-reread-before-manifest";
  readonly requestDigest:
    string;
}

const trustedReadyResolutions =
  new WeakSet<object>();

const trustedMigrationResolutions =
  new WeakSet<object>();

const trustedWriterEnforcementResolutions =
  new WeakSet<object>();

function sha256(
  value:
    string,
): string {
  return createHash("sha256")
    .update(
      value,
      "utf8",
    )
    .digest("hex");
}

function canonicalDigest(
  value:
    string,
  name:
    string,
): string {
  if (
    typeof value !== "string" ||
    !SHA256_PATTERN.test(value)
  ) {
    throw new Error(
      `${name} must be a lowercase SHA-256 digest.`,
    );
  }

  return value;
}

function canonicalKeyValue(
  value:
    string,
  name:
    string,
): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !KEY_PATTERN.test(value)
  ) {
    throw new Error(
      `${name} is invalid.`,
    );
  }

  return value;
}

function canonicalKey(
  input:
    Readonly<BusinessItemGenerationKey>,
): Readonly<BusinessItemGenerationKey> {
  if (!input) {
    throw new Error(
      "Business item generation key is required.",
    );
  }

  return Object.freeze({
    partitionKey:
      canonicalKeyValue(
        input.partitionKey,
        "Business item partition key",
      ),
    sortKey:
      canonicalKeyValue(
        input.sortKey,
        "Business item sort key",
      ),
  });
}

function issuedGenerationDigest(
  supersededGenerationDigest:
    string | null,
): string {
  const generation =
    randomBytes(
      BUSINESS_ITEM_GENERATION_ENTROPY_BYTES,
    ).toString("hex");

  if (
    supersededGenerationDigest !== null &&
    generation ===
      supersededGenerationDigest
  ) {
    throw new Error(
      "A recreated business item must receive a new generation.",
    );
  }

  return generation;
}

function frozenGenerationPrecondition(
  expectedGenerationDigest:
    string,
): Readonly<BusinessDeletionDynamoDbItemGenerationPrecondition> {
  return Object.freeze({
    ...BUSINESS_DELETION_DYNAMODB_ITEM_GENERATION_PRECONDITION,
    expectedGenerationDigest:
      canonicalDigest(
        expectedGenerationDigest,
        "Business item generation",
      ),
  });
}

export function createBusinessItemGenerationAtomicCreateContract(
  input:
    Readonly<{
      key:
        BusinessItemGenerationKey;
      itemPayloadDigest:
        string;
      supersededGenerationDigest?:
        string | null;
    }>,
): Readonly<BusinessItemGenerationAtomicCreateContract> {
  const key =
    canonicalKey(
      input.key,
    );

  const itemPayloadDigest =
    canonicalDigest(
      input.itemPayloadDigest,
      "Business item payload",
    );

  const supersededGenerationDigest =
    input.supersededGenerationDigest == null
      ? null
      : canonicalDigest(
          input.supersededGenerationDigest,
          "Superseded business item generation",
        );

  const deletionGuardDigest =
    issuedGenerationDigest(
      supersededGenerationDigest,
    );

  const unsigned = {
    schemaVersion:
      BUSINESS_ITEM_GENERATION_SCHEMA_VERSION,
    mode:
      "atomic-create-with-generation" as const,
    key,
    itemPayloadDigest,
    deletionGuardDigest,
    supersededGenerationDigest,
    atomicity:
      "item-and-generation-single-write" as const,
    condition:
      Object.freeze({
        kind:
          "key-absent" as const,
        partitionKeyAttributeName:
          "pk" as const,
        sortKeyAttributeName:
          "sk" as const,
      }),
  };

  return Object.freeze({
    ...unsigned,
    requestDigest:
      sha256(
        JSON.stringify(
          unsigned,
        ),
      ),
  });
}

export function assertBusinessItemGenerationImmutable(
  currentGenerationDigest:
    string,
  proposedGenerationDigest:
    string | null | undefined,
): string {
  const current =
    canonicalDigest(
      currentGenerationDigest,
      "Current business item generation",
    );

  if (
    proposedGenerationDigest == null ||
    proposedGenerationDigest !==
      current
  ) {
    throw new Error(
      "Business item generation is immutable for the lifetime of an item.",
    );
  }

  return current;
}

export function createBusinessItemGenerationUpdateContract(
  input:
    Readonly<{
      key:
        BusinessItemGenerationKey;
      itemPayloadDigest:
        string;
      currentGenerationDigest:
        string;
      proposedGenerationDigest:
        string | null | undefined;
    }>,
): Readonly<BusinessItemGenerationUpdateContract> {
  const key =
    canonicalKey(
      input.key,
    );

  const itemPayloadDigest =
    canonicalDigest(
      input.itemPayloadDigest,
      "Business item payload",
    );

  const deletionGuardDigest =
    assertBusinessItemGenerationImmutable(
      input.currentGenerationDigest,
      input.proposedGenerationDigest,
    );

  const unsigned = {
    schemaVersion:
      BUSINESS_ITEM_GENERATION_SCHEMA_VERSION,
    mode:
      "update-preserving-generation" as const,
    key,
    itemPayloadDigest,
    deletionGuardDigest,
    generationMutation:
      "forbidden" as const,
    condition:
      Object.freeze({
        kind:
          "generation-equals" as const,
        generationAttributeName:
          "deletionGuardDigest" as const,
        expectedGenerationDigest:
          deletionGuardDigest,
      }),
  };

  return Object.freeze({
    ...unsigned,
    requestDigest:
      sha256(
        JSON.stringify(
          unsigned,
        ),
      ),
  });
}

function observationDigest(
  result:
    Readonly<BusinessItemGenerationReadResult>,
): string {
  return sha256(
    JSON.stringify({
      source:
        result.source,
      consistency:
        result.consistency,
      outcome:
        result.outcome,
      partitionKey:
        result.partitionKey,
      sortKey:
        result.sortKey,
      deletionGuardDigest:
        result.outcome ===
        "present"
          ? result.deletionGuardDigest
          : null,
    }),
  );
}

export async function resolveBusinessItemGenerationForDeletion(
  reader:
    BusinessItemGenerationReader,
  requestedKey:
    Readonly<BusinessItemGenerationKey>,
): Promise<
  Readonly<BusinessItemGenerationResolution>
> {
  if (
    !reader ||
    typeof reader.readGeneration !==
      "function"
  ) {
    throw new Error(
      "A trusted business item generation reader is required.",
    );
  }

  const key =
    canonicalKey(
      requestedKey,
    );

  const result =
    await reader.readGeneration(
      key,
    );

  if (
    !result ||
    typeof result !==
      "object" ||
    Array.isArray(
      result,
    ) ||
    result.source !==
      "business-table-generation-read" ||
    result.consistency !==
      "strongly-consistent" ||
    result.partitionKey !==
      key.partitionKey ||
    result.sortKey !==
      key.sortKey ||
    ![
      "present",
      "legacy-missing-generation",
      "absent",
    ].includes(
      result.outcome,
    )
  ) {
    throw new Error(
      "Business item generation observation is not trusted or does not match the requested item.",
    );
  }

  if (
    result.outcome !==
      "present" &&
    "deletionGuardDigest" in
      result
  ) {
    throw new Error(
      "Business item generation observation is not trusted or does not match the requested item.",
    );
  }

  const digest =
    observationDigest(
      result,
    );

  if (
    result.outcome ===
    "present"
  ) {
    const resolution =
      Object.freeze({
        outcome:
          "ready-for-deletion-manifest" as const,
        key,
        itemGenerationPrecondition:
          frozenGenerationPrecondition(
            result.deletionGuardDigest,
          ),
        observationDigest:
          digest,
      });

    trustedReadyResolutions.add(
      resolution,
    );

    return resolution;
  }

  if (
    result.outcome ===
    "legacy-missing-generation"
  ) {
    const resolution =
      Object.freeze({
        outcome:
          "migration-required" as const,
        key,
        reason:
          "missing-deletion-guard" as const,
        observationDigest:
          digest,
      });

    trustedMigrationResolutions.add(
      resolution,
    );

    return resolution;
  }

  return Object.freeze({
    outcome:
      "item-absent" as const,
    key,
    observationDigest:
      digest,
  });
}

export async function resolveBusinessItemGenerationWriterEnforcement(
  authority:
    BusinessItemGenerationWriterEnforcementAuthority,
): Promise<
  Readonly<BusinessItemGenerationWriterEnforcementResolution>
> {
  if (
    !authority ||
    typeof authority.readWriterEnforcement !==
      "function"
  ) {
    throw new Error(
      "A trusted business item writer inventory authority is required.",
    );
  }

  const result =
    await authority
      .readWriterEnforcement();

  if (
    !result ||
    result.source !==
      "business-item-writer-inventory" ||
    result.state !==
      "enforced" ||
    result.version !==
      BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION
  ) {
    throw new Error(
      "Business item writer generation enforcement is not trusted or incomplete.",
    );
  }

  const resolution =
    Object.freeze({
      state:
        "writer-enforcement-verified" as const,
      version:
        BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION,
      inventoryDigest:
        canonicalDigest(
          result.inventoryDigest,
          "Business item writer inventory",
        ),
    });

  trustedWriterEnforcementResolutions.add(
    resolution,
  );

  return resolution;
}

export function createBusinessDeletionDynamoDbLocatorFromTrustedGeneration(
  resolution:
    Readonly<BusinessItemGenerationReadyResolution>,
  input:
    Readonly<{
      awsAccountId:
        string;
      awsRegion:
        string;
      estimatedItemBytes:
        number;
    }>,
): Readonly<BusinessDeletionDynamoDbLocator> {
  if (
    !resolution ||
    resolution.outcome !==
      "ready-for-deletion-manifest" ||
    !trustedReadyResolutions.has(
      resolution,
    )
  ) {
    throw new Error(
      "Deletion locators require a trusted strongly consistent item-generation observation.",
    );
  }

  if (
    !AWS_ACCOUNT_ID_PATTERN.test(
      input.awsAccountId,
    ) ||
    !AWS_REGION_PATTERN.test(
      input.awsRegion,
    ) ||
    !Number.isSafeInteger(
      input.estimatedItemBytes,
    ) ||
    input.estimatedItemBytes < 1 ||
    input.estimatedItemBytes >
      MAX_DYNAMODB_ITEM_BYTES
  ) {
    throw new Error(
      "Deletion locator infrastructure metadata is invalid.",
    );
  }

  return Object.freeze({
    system:
      "dynamodb",
    tableRole:
      "business-table",
    awsAccountId:
      input.awsAccountId,
    awsRegion:
      input.awsRegion,
    partitionKey:
      resolution.key.partitionKey,
    sortKey:
      resolution.key.sortKey,
    itemGenerationPrecondition:
      resolution.itemGenerationPrecondition,
    estimatedItemBytes:
      input.estimatedItemBytes,
  });
}

export function createBusinessItemGenerationLegacyMigrationContract(
  resolution:
    Readonly<BusinessItemGenerationMigrationRequiredResolution>,
  writerEnforcement:
    Readonly<BusinessItemGenerationWriterEnforcementResolution>,
): Readonly<BusinessItemGenerationLegacyMigrationContract> {
  if (
    !resolution ||
    resolution.outcome !==
      "migration-required" ||
    !trustedMigrationResolutions.has(
      resolution,
    )
  ) {
    throw new Error(
      "Legacy generation migration requires a trusted missing-generation observation.",
    );
  }

  if (
    !writerEnforcement ||
    writerEnforcement.state !==
      "writer-enforcement-verified" ||
    writerEnforcement.version !==
      BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION ||
    !trustedWriterEnforcementResolutions.has(
      writerEnforcement,
    )
  ) {
    throw new Error(
      "Legacy generation migration is blocked until all business item writers enforce generation v1.",
    );
  }

  const deletionGuardDigest =
    issuedGenerationDigest(
      null,
    );

  const unsigned = {
    schemaVersion:
      BUSINESS_ITEM_GENERATION_SCHEMA_VERSION,
    mode:
      "conditional-legacy-generation-backfill" as const,
    key:
      resolution.key,
    deletionGuardDigest,
    observationDigest:
      resolution.observationDigest,
    writerEnforcementVersion:
      BUSINESS_ITEM_GENERATION_WRITER_ENFORCEMENT_VERSION,
    writerEnforcementInventoryDigest:
      writerEnforcement.inventoryDigest,
    rolloutGate:
      "all-business-item-writers-enforce-generation-v1" as const,
    condition:
      Object.freeze({
        kind:
          "item-present-and-generation-absent" as const,
        partitionKeyAttributeName:
          "pk" as const,
        sortKeyAttributeName:
          "sk" as const,
        generationAttributeName:
          "deletionGuardDigest" as const,
      }),
    completionRequirement:
      "strongly-consistent-reread-before-manifest" as const,
  };

  return Object.freeze({
    ...unsigned,
    requestDigest:
      sha256(
        JSON.stringify(
          unsigned,
        ),
      ),
  });
}
