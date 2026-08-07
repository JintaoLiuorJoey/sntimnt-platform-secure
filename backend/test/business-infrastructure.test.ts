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
    it("provides dedicated business table and KMS key identifiers to the Lambda runtime", () => {
      expect(
        template,
      ).toContain(
        "BUSINESS_TABLE_NAME: !Ref BusinessTable",
      );

      expect(
        template,
      ).toContain(
        "BUSINESS_KMS_KEY_ID: !GetAtt BusinessKey.Arn",
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
        /Action:\s*\n\s*- kms:Encrypt\s*\n\s*- kms:Decrypt\s*\n\s*Resource: !GetAtt BusinessKey\.Arn/,
      );

      expect(
        functionBlock,
      ).not.toContain(
        "kms:DescribeKey",
      );

      expect(
        functionBlock,
      ).not.toContain(
        "kms:GenerateDataKey",
      );

      expect(
        functionBlock,
      ).not.toContain(
        "kms:ReEncrypt",
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

    it("defines a dedicated retained rotating KMS key with DynamoDB-only service authorization", () => {
      const keyBlock =
        block(
          "  DeletionControlKey:",
          "\n  DeletionControlKeyAlias:",
        );

      const aliasBlock =
        block(
          "  DeletionControlKeyAlias:",
          "\n  DeletionControlTable:",
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
        "Sid: AllowDynamoDbUseFromThisAccount",
      );

      for (
        const action of
        [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey",
          "kms:CreateGrant",
        ]
      ) {
        expect(
          keyBlock,
        ).toContain(
          `- ${action}`,
        );
      }

      expect(
        keyBlock,
      ).toContain(
        'AWS: "*"',
      );

      expect(
        keyBlock,
      ).toContain(
        "kms:CallerAccount: !Ref AWS::AccountId",
      );

      expect(
        keyBlock,
      ).toContain(
        'kms:ViaService: !Sub "dynamodb.*.${AWS::URLSuffix}"',
      );

      expect(
        aliasBlock,
      ).toContain(
        'AliasName: !Sub "alias/sntimnt-${EnvironmentName}-deletion-control"',
      );
    });

    it("defines a retained KMS-encrypted PITR deletion-control table with cleanup-only TTL infrastructure", () => {
      const tableBlock =
        block(
          "  DeletionControlTable:",
          "\n  UserPool:",
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
        "BillingMode: PAY_PER_REQUEST",
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
        "KMSMasterKeyId: !GetAtt DeletionControlKey.Arn",
      );

      expect(
        tableBlock,
      ).toContain(
        "PointInTimeRecoveryEnabled: true",
      );

      expect(
        tableBlock,
      ).toContain(
        "TimeToLiveSpecification:",
      );

      expect(
        tableBlock,
      ).toContain(
        "AttributeName: ttl",
      );

      expect(
        tableBlock,
      ).toContain(
        "Enabled: true",
      );

      expect(
        tableBlock,
      ).not.toContain(
        "GlobalSecondaryIndexes:",
      );

      expect(
        tableBlock,
      ).not.toContain(
        "LocalSecondaryIndexes:",
      );
    });

    it("binds deletion-control persistence only to AuthFunction with least-privilege table permissions", () => {
      const globalsBlock =
        block(
          "Globals:",
          "\nResources:",
        );

      const functionBlock =
        block(
          "  AuthFunction:",
          "\n  AuthTable:",
        );

      expect(
        globalsBlock,
      ).not.toContain(
        "DELETION_CONTROL_TABLE_NAME",
      );

      expect(
        functionBlock,
      ).toContain(
        "DELETION_CONTROL_TABLE_NAME: !Ref DeletionControlTable",
      );

      const deletionControlStatement =
        functionBlock.match(
          /- Effect: Allow\s*\n\s*Action:\s*\n(?:\s*- dynamodb:[A-Za-z]+\s*\n)+\s*Resource: !GetAtt DeletionControlTable\.Arn/,
        )?.[0];

      expect(
        deletionControlStatement,
      ).toBeDefined();

      expect(
        deletionControlStatement,
      ).toContain(
        "dynamodb:GetItem",
      );

      expect(
        deletionControlStatement,
      ).toContain(
        "dynamodb:PutItem",
      );

      expect(
        deletionControlStatement,
      ).toContain(
        "dynamodb:UpdateItem",
      );

      for (
        const forbiddenAction of
        [
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:ConditionCheckItem",
          "dynamodb:TransactWriteItems",
        ]
      ) {
        expect(
          deletionControlStatement,
        ).not.toContain(
          forbiddenAction,
        );
      }

      expect(
        functionBlock,
      ).not.toContain(
        "Resource: !GetAtt DeletionControlKey.Arn",
      );

      expect(
        functionBlock,
      ).not.toContain(
        "kms:CreateGrant",
      );

      expect(
        functionBlock,
      ).not.toContain(
        "kms:GenerateDataKey",
      );

      expect(
        functionBlock,
      ).not.toContain(
        "kms:ReEncrypt",
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
    });
  },
);
