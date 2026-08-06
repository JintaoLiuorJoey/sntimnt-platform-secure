import {
  BusinessKmsCipher,
  type BusinessKmsCipherConfig,
} from "./business-kms-cipher.js";
import {
  BusinessStore,
  type BusinessStoreConfig,
} from "./business-store.js";

function required(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value =
    environment[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is required.`,
    );
  }

  return value;
}

export function loadBusinessStoreConfig(
  environment:
    NodeJS.ProcessEnv = process.env,
): BusinessStoreConfig {
  return Object.freeze({
    region:
      required(
        environment,
        "AWS_REGION",
      ),
    tableName:
      required(
        environment,
        "BUSINESS_TABLE_NAME",
      ),
  });
}

export function loadBusinessKmsConfig(
  environment:
    NodeJS.ProcessEnv = process.env,
): BusinessKmsCipherConfig {
  return Object.freeze({
    region:
      required(
        environment,
        "AWS_REGION",
      ),
    kmsKeyId:
      required(
        environment,
        "BUSINESS_KMS_KEY_ID",
      ),
  });
}

let cachedBusinessStore:
  | BusinessStore
  | undefined;

let cachedBusinessCipher:
  | BusinessKmsCipher
  | undefined;

export function getBusinessStore():
  BusinessStore {
  if (!cachedBusinessStore) {
    cachedBusinessStore =
      new BusinessStore(
        loadBusinessStoreConfig(),
      );
  }

  return cachedBusinessStore;
}

export function getBusinessCipher():
  BusinessKmsCipher {
  if (!cachedBusinessCipher) {
    cachedBusinessCipher =
      new BusinessKmsCipher(
        loadBusinessKmsConfig(),
      );
  }

  return cachedBusinessCipher;
}
