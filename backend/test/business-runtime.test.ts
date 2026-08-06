import {
  describe,
  expect,
  it,
} from "vitest";
import {
  loadBusinessKmsConfig,
  loadBusinessStoreConfig,
} from "../src/business-runtime.js";

describe(
  "business store runtime configuration",
  () => {
    it("loads a trimmed region and dedicated business table name", () => {
      expect(
        loadBusinessStoreConfig({
          AWS_REGION:
            " us-east-1 ",
          BUSINESS_TABLE_NAME:
            " business-table ",
        }),
      ).toEqual({
        region: "us-east-1",
        tableName:
          "business-table",
      });
    });

    it.each([
      "AWS_REGION",
      "BUSINESS_TABLE_NAME",
    ] as const)(
      "requires %s",
      (name: "AWS_REGION" | "BUSINESS_TABLE_NAME") => {
        const environment:
          Partial<
            Record<
              "AWS_REGION" |
              "BUSINESS_TABLE_NAME",
              string
            >
          > = {
            AWS_REGION:
              "us-east-1",
            BUSINESS_TABLE_NAME:
              "business-table",
          };

        delete environment[name];

        expect(() =>
          loadBusinessStoreConfig(
            environment,
          ),
        ).toThrow(
          `${name} is required.`,
        );
      },
    );

    it("returns an immutable configuration object", () => {
      const config =
        loadBusinessStoreConfig({
          AWS_REGION:
            "us-east-1",
          BUSINESS_TABLE_NAME:
            "business-table",
        });

      expect(
        Object.isFrozen(config),
      ).toBe(true);
    });
  },
);

describe(
  "business KMS runtime configuration",
  () => {
    const keyArn =
      "arn:aws:kms:us-east-1:123456789012:key/11111111-2222-3333-4444-555555555555";

    it("loads a trimmed region and dedicated business KMS key", () => {
      expect(
        loadBusinessKmsConfig({
          AWS_REGION:
            " us-east-1 ",
          BUSINESS_KMS_KEY_ID:
            ` ${keyArn} `,
        }),
      ).toEqual({
        region: "us-east-1",
        kmsKeyId:
          keyArn,
      });
    });

    it.each([
      "AWS_REGION",
      "BUSINESS_KMS_KEY_ID",
    ] as const)(
      "requires %s",
      (
        name:
          | "AWS_REGION"
          | "BUSINESS_KMS_KEY_ID",
      ) => {
        const environment:
          Partial<
            Record<
              | "AWS_REGION"
              | "BUSINESS_KMS_KEY_ID",
              string
            >
          > = {
            AWS_REGION:
              "us-east-1",
            BUSINESS_KMS_KEY_ID:
              keyArn,
          };

        delete environment[name];

        expect(() =>
          loadBusinessKmsConfig(
            environment,
          ),
        ).toThrow(
          `${name} is required.`,
        );
      },
    );

    it("returns an immutable KMS configuration object", () => {
      const config =
        loadBusinessKmsConfig({
          AWS_REGION:
            "us-east-1",
          BUSINESS_KMS_KEY_ID:
            keyArn,
        });

      expect(
        Object.isFrozen(config),
      ).toBe(true);
    });
  },
);
