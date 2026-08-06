import {
  describe,
  expect,
  it,
} from "vitest";
import {
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