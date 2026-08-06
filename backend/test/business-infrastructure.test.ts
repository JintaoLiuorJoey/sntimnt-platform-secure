import {
  readFileSync,
} from "node:fs";
import {
  describe,
  expect,
  it,
} from "vitest";

const template =
  readFileSync(
    new URL(
      "../template.yaml",
      import.meta.url,
    ),
    "utf8",
  );

function block(
  startMarker: string,
  endMarker: string,
): string {
  const start =
    template.indexOf(
      startMarker,
    );

  const end =
    template.indexOf(
      endMarker,
      start +
        startMarker.length,
    );

  if (
    start < 0 ||
    end < 0
  ) {
    throw new Error(
      `Unable to locate template block ${startMarker}.`,
    );
  }

  return template.slice(
    start,
    end,
  );
}

describe(
  "business API infrastructure boundary",
  () => {
    it("provides the dedicated business table name to the Lambda runtime", () => {
      expect(
        template,
      ).toContain(
        "BUSINESS_TABLE_NAME: !Ref BusinessTable",
      );
    });

    it("exposes only the GET investment-account collection route", () => {
      const functionBlock =
        block(
          "  AuthFunction:",
          "\n  AuthTable:",
        );

      expect(
        functionBlock,
      ).toContain(
        "Path: /api/me/investment-accounts",
      );

      expect(
        functionBlock,
      ).toContain(
        "Method: GET",
      );

      expect(
        functionBlock,
      ).not.toContain(
        "Method: POST",
      );
    });

    it("grants Query rather than Scan against only the business table", () => {
      const functionBlock =
        block(
          "  AuthFunction:",
          "\n  AuthTable:",
        );

      expect(
        functionBlock,
      ).toMatch(
        /Action:\s*\n\s*- dynamodb:Query\s*\n\s*Resource: !GetAtt BusinessTable\.Arn/,
      );

      expect(
        functionBlock,
      ).not.toContain(
        "dynamodb:Scan",
      );

      expect(
        functionBlock,
      ).toMatch(
        /Action:\s*\n\s*- kms:Decrypt\s*\n\s*- kms:DescribeKey\s*\n\s*Resource: !GetAtt BusinessKey\.Arn/,
      );
    });

    it("defines a retained point-in-time-recoverable owner-partitioned business table", () => {
      const tableBlock =
        block(
          "  BusinessTable:",
          "\n  AuthKey:",
        );

      expect(
        tableBlock,
      ).toContain(
        "DeletionPolicy: Retain",
      );

      expect(
        tableBlock,
      ).toContain(
        "UpdateReplacePolicy: Retain",
      );

      expect(
        tableBlock,
      ).toContain(
        "AttributeName: pk",
      );

      expect(
        tableBlock,
      ).toContain(
        "AttributeName: sk",
      );

      expect(
        tableBlock,
      ).toContain(
        "KeyType: HASH",
      );

      expect(
        tableBlock,
      ).toContain(
        "KeyType: RANGE",
      );

      expect(
        tableBlock,
      ).toContain(
        "KMSMasterKeyId: !GetAtt BusinessKey.Arn",
      );

      expect(
        tableBlock,
      ).toContain(
        "PointInTimeRecoveryEnabled: true",
      );

      expect(
        tableBlock,
      ).not.toContain(
        "TimeToLiveSpecification",
      );
    });

    it("uses a separate retained rotating KMS key for business records", () => {
      const keyBlock =
        block(
          "  BusinessKey:",
          "\n  BusinessTable:",
        );

      expect(
        keyBlock,
      ).toContain(
        "DeletionPolicy: Retain",
      );

      expect(
        keyBlock,
      ).toContain(
        "UpdateReplacePolicy: Retain",
      );

      expect(
        keyBlock,
      ).toContain(
        "EnableKeyRotation: true",
      );

      expect(
        keyBlock,
      ).toContain(
        'AliasName: !Sub "alias/sntimnt-${EnvironmentName}-business"',
      );
    });
  },
);