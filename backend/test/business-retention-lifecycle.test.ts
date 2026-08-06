import {
  describe,
  expect,
  it,
} from "vitest";
import {
  BUSINESS_DELETION_AUDIT_EVENTS,
  BUSINESS_DELETION_COMPONENTS,
  BUSINESS_KMS_DELETION_BOUNDARY,
  BUSINESS_RETENTION_POLICY_BASIS,
  BUSINESS_RETENTION_POLICY_VERSION,
  BUSINESS_TTL_BOUNDARY,
  businessRetentionDeadline,
  businessRetentionPolicy,
  decideBusinessDeletion,
  type BusinessAccountLifecycle,
  type BusinessDeletionDecisionInput,
  type BusinessDeletionOutcome,
} from "../src/business-retention-lifecycle.js";
import {
  BUSINESS_SENSITIVE_RECORD_TYPES,
} from "../src/business-data-protection.js";
import {
  safeSecurityLog,
} from "../src/security-log.js";

const OWNER_ONE =
  "BUSINESS#OWNER#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const OWNER_TWO =
  "BUSINESS#OWNER#BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const REQUEST_ONE =
  "del_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const REQUEST_TWO =
  "del_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const EVIDENCE_ONE =
  "a".repeat(64);

const EVIDENCE_TWO =
  "b".repeat(64);

function baseInput(
  overrides:
    Partial<BusinessDeletionDecisionInput> = {},
): BusinessDeletionDecisionInput {
  return {
    authorizedOwnerPartitionKey:
      OWNER_ONE,
    targetOwnerPartitionKey:
      OWNER_ONE,
    recordType:
      "investor-profile",
    recordRetentionAnchorAt:
      "2026-01-01T00:00:00.000Z",
    account: {
      status:
        "closed",
      requestedAt:
        "2026-05-01T00:00:00.000Z",
      closedAt:
        "2026-06-01T00:00:00.000Z",
    },
    legalHold: {
      status:
        "none",
    },
    policyApproval: {
      status:
        "approved",
      version:
        BUSINESS_RETENTION_POLICY_VERSION,
      approvedAt:
        "2026-06-02T00:00:00.000Z",
      evidenceReferenceHash:
        EVIDENCE_ONE,
    },
    request: {
      idempotencyKey:
        REQUEST_ONE,
      requestedAt:
        "2032-06-01T00:00:00.000Z",
    },
    now:
      "2032-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe(
  "business retention policies",
  () => {
    it("defines a frozen provisional policy for every sensitive record type", () => {
      const expected = {
        "investor-profile": [
          6,
          "record-superseded",
        ],
        "identity-verification": [
          5,
          "verification-recorded",
        ],
        "banking-instrument": [
          6,
          "banking-instrument-last-used",
        ],
        "money-movement": [
          6,
          "money-movement-settled",
        ],
        "portfolio-position": [
          6,
          "position-closed",
        ],
        "trade-record": [
          6,
          "trade-recorded",
        ],
      } as const;

      for (
        const recordType of
        BUSINESS_SENSITIVE_RECORD_TYPES
      ) {
        const policy =
          businessRetentionPolicy(
            recordType,
          );

        expect(
          policy,
        ).toMatchObject({
          version:
            BUSINESS_RETENTION_POLICY_VERSION,
          basis:
            BUSINESS_RETENTION_POLICY_BASIS,
          recordType,
          minimumRetentionYears:
            expected[recordType][0],
          recordAnchor:
            expected[recordType][1],
          effectiveAnchor:
            "later-of-account-closure-and-record-anchor",
          authoritativeRecordTtl:
            "prohibited",
          deletionMode:
            "explicit-verified-resumable",
          completionRequiresAllComponents:
            true,
          kmsKeyDeletionSubstitute:
            false,
          requiresComplianceApproval:
            true,
        });

        expect(
          policy.deletionComponents,
        ).toEqual(
          BUSINESS_DELETION_COMPONENTS,
        );

        expect(
          Object.isFrozen(policy),
        ).toBe(true);
      }
    });

    it("uses the later account or record anchor and calendar years", () => {
      expect(
        businessRetentionDeadline(
          "investor-profile",
          "2026-06-01T00:00:00.000Z",
          "2027-02-01T00:00:00.000Z",
        ),
      ).toBe(
        "2033-02-01T00:00:00.000Z",
      );

      expect(
        businessRetentionDeadline(
          "identity-verification",
          "2026-06-01T00:00:00.000Z",
          "2026-01-01T00:00:00.000Z",
        ),
      ).toBe(
        "2031-06-01T00:00:00.000Z",
      );
    });

    it("prohibits authoritative-record TTL and key deletion as deletion substitutes", () => {
      expect(
        BUSINESS_TTL_BOUNDARY,
      ).toEqual({
        authoritativeSensitiveRecords:
          "prohibited",
        transientWorkflowMarkers:
          "permitted-only-after-explicit-policy-review",
        exactDeletionGuarantee:
          false,
      });

      expect(
        BUSINESS_KMS_DELETION_BOUNDARY,
      ).toEqual({
        keyDisablementDeletesRecords:
          false,
        keyDeletionDeletesRecords:
          false,
        perRecordDeletionStillRequired:
          true,
      });
    });
  },
);

describe(
  "business deletion lifecycle decisions",
  () => {
    it("denies a target outside the server-derived owner scope", () => {
      const decision =
        decideBusinessDeletion(
          baseInput({
            targetOwnerPartitionKey:
              OWNER_TWO,
          }),
        );

      expect(
        decision,
      ).toMatchObject({
        outcome:
          "deny-owner-mismatch",
        auditEvent:
          "business_deletion_denied",
        deleteAuthorized:
          false,
        remainingComponents: [],
      });

      const rendered =
        JSON.stringify(decision);

      expect(
        rendered,
      ).not.toContain(
        OWNER_ONE,
      );

      expect(
        rendered,
      ).not.toContain(
        OWNER_TWO,
      );

      expect(
        rendered,
      ).not.toContain(
        REQUEST_ONE,
      );
    });

    it.each([
      [
        {
          status:
            "open",
        },
        "retain-account-open",
      ],
      [
        {
          status:
            "closure-requested",
          requestedAt:
            "2026-05-01T00:00:00.000Z",
        },
        "retain-closure-pending",
      ],
    ] as const)(
      "does not treat an account closure request as deletion eligibility",
      (
        account:
          BusinessAccountLifecycle,
        outcome:
          BusinessDeletionOutcome,
      ) => {
        expect(
          decideBusinessDeletion(
            baseInput({
              account,
            }),
          ),
        ).toMatchObject({
          outcome,
          deleteAuthorized:
            false,
          auditEvent:
            "business_deletion_blocked",
        });
      },
    );

    it("blocks deletion until the provisional policy is explicitly approved", () => {
      expect(
        decideBusinessDeletion(
          baseInput({
            policyApproval: {
              status:
                "pending",
            },
          }),
        ),
      ).toMatchObject({
        outcome:
          "retain-policy-approval",
        deleteAuthorized:
          false,
      });
    });

    it("gives an active legal hold precedence after retention and during partial progress", () => {
      const decision =
        decideBusinessDeletion(
          baseInput({
            legalHold: {
              status:
                "active",
              authority:
                "legal",
              startedAt:
                "2032-05-01T00:00:00.000Z",
              evidenceReferenceHash:
                EVIDENCE_ONE,
            },
            existingProgress: {
              idempotencyKey:
                REQUEST_ONE,
              state:
                "in-progress",
              deletedComponents: [
                "ciphertext",
              ],
              updatedAt:
                "2032-05-15T00:00:00.000Z",
            },
          }),
        );

      expect(
        decision,
      ).toMatchObject({
        outcome:
          "retain-legal-hold",
        deleteAuthorized:
          false,
        remainingComponents: [
          "derived-indexes",
        ],
      });
    });

    it("allows a properly evidenced released hold to stop blocking", () => {
      expect(
        decideBusinessDeletion(
          baseInput({
            legalHold: {
              status:
                "released",
              authority:
                "compliance",
              startedAt:
                "2031-01-01T00:00:00.000Z",
              evidenceReferenceHash:
                EVIDENCE_ONE,
              releasedAt:
                "2032-01-01T00:00:00.000Z",
              releaseEvidenceReferenceHash:
                EVIDENCE_TWO,
            },
          }),
        ),
      ).toMatchObject({
        outcome:
          "eligible-to-delete",
        deleteAuthorized:
          true,
      });
    });

    it("retains records until the complete minimum period has elapsed", () => {
      expect(
        decideBusinessDeletion(
          baseInput({
            request: {
              idempotencyKey:
                REQUEST_ONE,
              requestedAt:
                "2032-05-31T23:59:59.999Z",
            },
            now:
              "2032-05-31T23:59:59.999Z",
          }),
        ),
      ).toMatchObject({
        outcome:
          "retain-minimum-period",
        retentionDeadline:
          "2032-06-01T00:00:00.000Z",
        deleteAuthorized:
          false,
      });
    });

    it("authorizes an explicit verified plan only after every gate passes", () => {
      const decision =
        decideBusinessDeletion(
          baseInput(),
        );

      expect(
        decision,
      ).toEqual({
        outcome:
          "eligible-to-delete",
        auditEvent:
          "business_deletion_eligible",
        deleteAuthorized:
          true,
        retentionDeadline:
          "2032-06-01T00:00:00.000Z",
        remainingComponents: [
          "ciphertext",
          "derived-indexes",
        ],
        completionRequiresAllComponents:
          true,
        authoritativeRecordTtl:
          "prohibited",
        kmsKeyDeletionSubstitute:
          false,
      });

      expect(
        Object.isFrozen(decision),
      ).toBe(true);

      expect(
        Object.isFrozen(
          decision.remainingComponents,
        ),
      ).toBe(true);
    });

    it("resumes the same idempotent workflow after partial deletion", () => {
      expect(
        decideBusinessDeletion(
          baseInput({
            existingProgress: {
              idempotencyKey:
                REQUEST_ONE,
              state:
                "in-progress",
              deletedComponents: [
                "ciphertext",
              ],
              updatedAt:
                "2032-05-31T00:00:00.000Z",
            },
          }),
        ),
      ).toMatchObject({
        outcome:
          "resume-deletion",
        auditEvent:
          "business_deletion_resumed",
        deleteAuthorized:
          true,
        remainingComponents: [
          "derived-indexes",
        ],
      });
    });

    it("returns the prior result for a completed repeated request", () => {
      expect(
        decideBusinessDeletion(
          baseInput({
            existingProgress: {
              idempotencyKey:
                REQUEST_ONE,
              state:
                "completed",
              deletedComponents: [
                "ciphertext",
                "derived-indexes",
              ],
              updatedAt:
                "2032-05-31T00:00:00.000Z",
              completedAt:
                "2032-05-31T01:00:00.000Z",
            },
          }),
        ),
      ).toMatchObject({
        outcome:
          "already-deleted",
        auditEvent:
          "business_deletion_replayed",
        deleteAuthorized:
          false,
        remainingComponents: [],
      });
    });

    it("rejects a different idempotency key while progress exists", () => {
      expect(
        decideBusinessDeletion(
          baseInput({
            request: {
              idempotencyKey:
                REQUEST_TWO,
              requestedAt:
                "2032-06-01T00:00:00.000Z",
            },
            existingProgress: {
              idempotencyKey:
                REQUEST_ONE,
              state:
                "in-progress",
              deletedComponents: [],
              updatedAt:
                "2032-05-31T00:00:00.000Z",
            },
          }),
        ),
      ).toMatchObject({
        outcome:
          "conflict-idempotency-key",
        auditEvent:
          "business_deletion_conflict",
        deleteAuthorized:
          false,
      });
    });

    it("rejects false completion and impossible active-hold history", () => {
      expect(() =>
        decideBusinessDeletion(
          baseInput({
            existingProgress: {
              idempotencyKey:
                REQUEST_ONE,
              state:
                "completed",
              deletedComponents: [
                "ciphertext",
              ],
              updatedAt:
                "2032-05-31T00:00:00.000Z",
              completedAt:
                "2032-05-31T01:00:00.000Z",
            },
          }),
        ),
      ).toThrow(
        "Completed deletion must verify every component.",
      );

      expect(() =>
        decideBusinessDeletion(
          baseInput({
            legalHold: {
              status:
                "active",
              authority:
                "regulator",
              startedAt:
                "2032-05-31T02:00:00.000Z",
              evidenceReferenceHash:
                EVIDENCE_ONE,
            },
            existingProgress: {
              idempotencyKey:
                REQUEST_ONE,
              state:
                "completed",
              deletedComponents: [
                "ciphertext",
                "derived-indexes",
              ],
              updatedAt:
                "2032-05-31T00:00:00.000Z",
              completedAt:
                "2032-05-31T01:00:00.000Z",
            },
          }),
        ),
      ).toThrow(
        "Completed deletion cannot coexist with an active legal hold.",
      );
    });

    it.each([
      {
        request: {
          idempotencyKey:
            "customer-email@example.com",
          requestedAt:
            "2032-06-01T00:00:00.000Z",
        },
      },
      {
        policyApproval: {
          status:
            "approved" as const,
          version:
            BUSINESS_RETENTION_POLICY_VERSION,
          approvedAt:
            "2026-06-02T00:00:00.000Z",
          evidenceReferenceHash:
            "not-a-hash",
        },
      },
      {
        account: {
          status:
            "closed" as const,
          requestedAt:
            "2026-06-02T00:00:00.000Z",
          closedAt:
            "2026-06-01T00:00:00.000Z",
        },
      },
      {
        now:
          "2032-06-01",
      },
    ])(
      "fails closed on malformed lifecycle evidence",
      (
        overrides:
          Partial<
            BusinessDeletionDecisionInput
          >,
      ) => {
        expect(() =>
          decideBusinessDeletion(
            baseInput(overrides),
          ),
        ).toThrow();
      },
    );

    it("keeps deletion audit events compatible with the safe-log allowlist", () => {
      expect(
        BUSINESS_DELETION_AUDIT_EVENTS,
      ).toHaveLength(7);

      for (
        const event of
        BUSINESS_DELETION_AUDIT_EVENTS
      ) {
        const log =
          safeSecurityLog(
            event,
            {
              requestId:
                "request-123",
              error:
                new Error(
                  "owner and record details",
                ),
            },
          );

        expect(
          log,
        ).toEqual({
          event,
          requestId:
            "request-123",
          errorName:
            "Error",
        });

        const rendered =
          JSON.stringify(log);

        expect(
          rendered,
        ).not.toContain(
          OWNER_ONE,
        );

        expect(
          rendered,
        ).not.toContain(
          REQUEST_ONE,
        );

        expect(
          rendered,
        ).not.toContain(
          "owner and record details",
        );
      }
    });
  },
);
