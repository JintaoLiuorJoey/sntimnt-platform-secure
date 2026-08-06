import { describe, expect, it } from "vitest";
import { investorBusinessScope } from "../src/business-authorization.js";
import type {
  SessionRecord,
  UserRole,
} from "../src/types.js";

const CANONICAL_SUBJECT = "cognito-subject-123";

interface SessionInput {
  roles?: UserRole[];
  subject?: string;
  userId?: string;
  email?: string;
  displayName?: string;
}

function session(input: SessionInput = {}): SessionRecord {
  const roles = input.roles ?? ["investor"];

  return {
    pk: "AUTH#SESSION#test",
    kind: "session",
    user: {
      id: input.userId ?? "mutable-application-user-id",
      email: input.email ?? "investor@example.com",
      displayName: input.displayName ?? "Verified Investor",
      roles,
    },
    adminMfaConfiguration: roles.includes("admin")
      ? "configured"
      : "not-required",
    refreshTokenCiphertext: "refresh-ciphertext",
    accessTokenCiphertext: "access-ciphertext",
    csrfHash: "csrf-hash",
    subject: input.subject ?? CANONICAL_SUBJECT,
    authenticatedAt: 900,
    createdAt: 900,
    lastSeenAt: 1_000,
    absoluteExpiresAt: 2_000,
    idleExpiresAt: 1_500,
    tokenExpiresAt: 1_300,
    ttl: 2_000,
  };
}

function allowedPartitionKey(record: SessionRecord): string {
  const decision = investorBusinessScope(record);

  expect(decision.status).toBe("allow");

  if (decision.status !== "allow") {
    throw new Error("Expected an allowed investor business scope.");
  }

  return decision.ownerPartitionKey;
}

describe("investor business ownership scope", () => {
  it("requires an authenticated server-side session", () => {
    expect(investorBusinessScope(null)).toEqual({
      status: "authentication-required",
    });
  });

  it("fails closed when the canonical session subject is empty", () => {
    expect(
      investorBusinessScope(
        session({
          subject: "",
        }),
      ),
    ).toEqual({
      status: "authentication-required",
    });
  });

  it.each([
    "admin",
    "operations",
  ] as const)(
    "does not grant the %s role implicit investor-account access",
    (role) => {
      expect(
        investorBusinessScope(
          session({
            roles: [role],
          }),
        ),
      ).toEqual({
        status: "forbidden",
      });
    },
  );

  it("derives a deterministic hashed owner partition from the canonical subject", () => {
    const ownerPartitionKey =
      allowedPartitionKey(session());

    expect(ownerPartitionKey).toBe(
      "BUSINESS#OWNER#L_d07hgadFqb9wRn9p2osQEj5jdB0bDtuJLyu3YbwjE",
    );

    expect(ownerPartitionKey).not.toContain(
      CANONICAL_SUBJECT,
    );

    expect(ownerPartitionKey).not.toContain(
      "investor@example.com",
    );

    expect(ownerPartitionKey).not.toContain(
      "mutable-application-user-id",
    );
  });

  it("does not derive ownership from mutable user display fields", () => {
    const first =
      allowedPartitionKey(
        session({
          userId: "first-user-id",
          email: "first@example.com",
          displayName: "First Name",
        }),
      );

    const second =
      allowedPartitionKey(
        session({
          userId: "second-user-id",
          email: "second@example.com",
          displayName: "Second Name",
        }),
      );

    expect(second).toBe(first);
  });

  it("creates a different owner partition for a different canonical subject", () => {
    const first =
      allowedPartitionKey(
        session({
          subject: "subject-one",
        }),
      );

    const second =
      allowedPartitionKey(
        session({
          subject: "subject-two",
        }),
      );

    expect(second).not.toBe(first);
  });

  it("allows a multi-role user only when investor is explicitly present", () => {
    expect(
      investorBusinessScope(
        session({
          roles: [
            "admin",
            "investor",
          ],
        }),
      ).status,
    ).toBe("allow");
  });
});