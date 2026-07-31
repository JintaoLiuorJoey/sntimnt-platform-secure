import { describe, expect, it } from "vitest";
import type { AuthConfig } from "../src/config.js";
import {
  createSessionRecord,
  hasRecentAuthentication,
  isSessionExpired,
  publicSession,
  rotateSessionRecord,
} from "../src/session.js";
import type { SessionRecord } from "../src/types.js";

const config = {
  absoluteTtlSeconds: 28_800,
  idleTtlSeconds: 1_800,
} as AuthConfig;

const user = {
  id: "user-1",
  email: "investor@example.com",
  displayName: "Investor",
  roles: ["investor" as const],
};

const adminUser = {
  ...user,
  email: "admin@example.com",
  displayName: "Administrator",
  roles: ["admin" as const],
};

function storedSession(authenticatedAt = 900): SessionRecord {
  return {
    ...createSessionRecord({
      config,
      now: 1_000,
      user,
      subject: "user-1",
      authenticatedAt,
      refreshTokenCiphertext: "ciphertext",
      accessTokenCiphertext: "access-ciphertext",
      csrfHash: "hash",
      tokenExpiresAt: 4_600,
    }),
    pk: "pk",
  };
}

describe("server-side session lifecycle", () => {
  it("enforces separate absolute and idle deadlines", () => {
    const record = createSessionRecord({
      config,
      now: 1_000,
      user,
      subject: "user-1",
      authenticatedAt: 900,
      refreshTokenCiphertext: "ciphertext",
      accessTokenCiphertext: "access-ciphertext",
      csrfHash: "hash",
      tokenExpiresAt: 4_600,
    });

    expect(record.absoluteExpiresAt).toBe(29_800);
    expect(record.idleExpiresAt).toBe(2_800);
    expect(record.authenticatedAt).toBe(900);
    expect(
      record.adminMfaConfiguration,
    ).toBe("not-required");
    expect(isSessionExpired({ ...record, pk: "pk" }, 2_799)).toBe(false);
    expect(isSessionExpired({ ...record, pk: "pk" }, 2_800)).toBe(true);
  });

  it("fails closed for a legacy session without authentication time", () => {
    const record = {
      ...createSessionRecord({
        config,
        now: 1_000,
        user,
        subject: "user-1",
        authenticatedAt: 900,
        refreshTokenCiphertext: "ciphertext",
        accessTokenCiphertext: "access-ciphertext",
        csrfHash: "hash",
        tokenExpiresAt: 4_600,
      }),
      pk: "pk",
    } satisfies SessionRecord;

    const legacyRecord: Partial<SessionRecord> = { ...record };
    delete legacyRecord.authenticatedAt;

    expect(isSessionExpired(legacyRecord as SessionRecord, 1_001)).toBe(true);
  });

  it("fails closed for a legacy session without encrypted access token", () => {
    const legacyRecord: Partial<SessionRecord> = {
      ...storedSession(),
    };

    delete legacyRecord.accessTokenCiphertext;

    expect(
      isSessionExpired(
        legacyRecord as SessionRecord,
        1_001,
      ),
    ).toBe(true);
  });

  it("fails closed for a legacy session without administrator MFA state", () => {
    const legacyRecord: Partial<SessionRecord> = {
      ...storedSession(),
    };

    delete legacyRecord.adminMfaConfiguration;

    expect(
      isSessionExpired(
        legacyRecord as SessionRecord,
        1_001,
      ),
    ).toBe(true);
  });

  it("defaults administrator sessions to enrollment-required", () => {
    const record = createSessionRecord({
      config,
      now: 1_000,
      user: adminUser,
      subject: "admin-1",
      authenticatedAt: 900,
      refreshTokenCiphertext: "ciphertext",
      accessTokenCiphertext:
        "access-ciphertext",
      csrfHash: "hash",
      tokenExpiresAt: 4_600,
    });

    expect(
      record.adminMfaConfiguration,
    ).toBe("enrollment-required");
  });

  it("rejects an administrator session marked not-required", () => {
    expect(() =>
      createSessionRecord({
        config,
        now: 1_000,
        user: adminUser,
        adminMfaConfiguration:
          "not-required",
        subject: "admin-1",
        authenticatedAt: 900,
        refreshTokenCiphertext:
          "ciphertext",
        accessTokenCiphertext:
          "access-ciphertext",
        csrfHash: "hash",
        tokenExpiresAt: 4_600,
      }),
    ).toThrow(
      "Administrator MFA configuration does not match the session roles.",
    );
  });

  it("rejects a non-administrator session marked configured", () => {
    expect(() =>
      createSessionRecord({
        config,
        now: 1_000,
        user,
        adminMfaConfiguration:
          "configured",
        subject: "user-1",
        authenticatedAt: 900,
        refreshTokenCiphertext:
          "ciphertext",
        accessTokenCiphertext:
          "access-ciphertext",
        csrfHash: "hash",
        tokenExpiresAt: 4_600,
      }),
    ).toThrow(
      "Administrator MFA configuration does not match the session roles.",
    );
  });

  it.each([
    ["a string", "900"],
    ["a fractional number", 900.5],
    ["a negative number", -1],
    ["later than the permitted clock skew", 1_061],
  ])(
    "fails closed for an invalid stored authentication time that is %s",
    (_description, authenticatedAt) => {
      const record = {
        ...createSessionRecord({
          config,
          now: 1_000,
          user,
          subject: "user-1",
          authenticatedAt: 900,
          refreshTokenCiphertext: "ciphertext",
          accessTokenCiphertext: "access-ciphertext",
          csrfHash: "hash",
          tokenExpiresAt: 4_600,
        }),
        pk: "pk",
      } satisfies SessionRecord;

      expect(
        isSessionExpired(
          { ...record, authenticatedAt } as SessionRecord,
          1_001,
        ),
      ).toBe(true);
    },
  );

  it("rotates session state without extending the absolute timeout", () => {
    const existing = {
      ...createSessionRecord({
        config,
        now: 1_000,
        user,
        subject: "user-1",
        authenticatedAt: 900,
        refreshTokenCiphertext: "old",
        accessTokenCiphertext: "old-access",
        csrfHash: "old-hash",
        tokenExpiresAt: 4_600,
      }),
      pk: "pk",
    } satisfies SessionRecord;

    const rotated = rotateSessionRecord({
      config,
      existing,
      now: 2_000,
      user,
      refreshTokenCiphertext: "new",
      accessTokenCiphertext: "new-access",
      csrfHash: "new-hash",
      tokenExpiresAt: 5_600,
    });

    expect(rotated.absoluteExpiresAt).toBe(existing.absoluteExpiresAt);
    expect(rotated.idleExpiresAt).toBe(3_800);
    expect(rotated.authenticatedAt).toBe(existing.authenticatedAt);
    expect(rotated.refreshTokenCiphertext).toBe("new");
    expect(rotated.accessTokenCiphertext).toBe("new-access");
  });

  it("updates and preserves configured administrator MFA state during rotation", () => {
    const existing = {
      ...createSessionRecord({
        config,
        now: 1_000,
        user: adminUser,
        subject: "admin-1",
        authenticatedAt: 900,
        refreshTokenCiphertext: "old",
        accessTokenCiphertext:
          "old-access",
        csrfHash: "old-hash",
        tokenExpiresAt: 4_600,
      }),
      pk: "pk",
    } satisfies SessionRecord;

    expect(
      existing.adminMfaConfiguration,
    ).toBe("enrollment-required");

    const configured =
      rotateSessionRecord({
        config,
        existing,
        now: 2_000,
        user: adminUser,
        adminMfaConfiguration:
          "configured",
        refreshTokenCiphertext: "new",
        accessTokenCiphertext:
          "new-access",
        csrfHash: "new-hash",
        tokenExpiresAt: 5_600,
      });

    expect(
      configured.adminMfaConfiguration,
    ).toBe("configured");

    const preserved =
      rotateSessionRecord({
        config,
        existing: {
          ...configured,
          pk: "next-pk",
        },
        now: 2_100,
        user: adminUser,
        refreshTokenCiphertext:
          "newer",
        accessTokenCiphertext:
          "newer-access",
        csrfHash: "newer-hash",
        tokenExpiresAt: 5_700,
      });

    expect(
      preserved.adminMfaConfiguration,
    ).toBe("configured");
  });

  it("accepts recent authentication within and at the policy boundary", () => {
    const record = storedSession();

    expect(hasRecentAuthentication(record, 1_199, 300)).toBe(true);
    expect(hasRecentAuthentication(record, 1_200, 300)).toBe(true);
  });

  it("rejects authentication older than the policy window", () => {
    expect(hasRecentAuthentication(storedSession(), 1_201, 300)).toBe(
      false,
    );
  });

  it("permits limited clock skew without accepting excessive future time", () => {
    expect(
      hasRecentAuthentication(storedSession(1_050), 1_000, 300),
    ).toBe(true);

    expect(
      hasRecentAuthentication(storedSession(1_061), 1_000, 300),
    ).toBe(false);
  });

  it.each([
    ["zero", 0],
    ["fractional", 300.5],
  ])(
    "rejects a recent-authentication policy window that is %s",
    (_description, maxAgeSeconds) => {
      expect(
        hasRecentAuthentication(storedSession(), 1_100, maxAgeSeconds),
      ).toBe(false);
    },
  );

  it("returns only public identity and timing data", () => {
    const record = {
      ...createSessionRecord({
        config,
        now: 1_000,
        user,
        subject: "user-1",
        authenticatedAt: 900,
        refreshTokenCiphertext: "secret-token",
        accessTokenCiphertext: "secret-access-token",
        csrfHash: "secret-hash",
        tokenExpiresAt: 4_600,
      }),
      pk: "pk",
    } satisfies SessionRecord;

    const response = publicSession(record, 1_000);

    expect(response.user).toEqual(user);
    expect(response).not.toHaveProperty("authenticatedAt");
    expect(response).not.toHaveProperty("refreshTokenCiphertext");
    expect(response).not.toHaveProperty("accessTokenCiphertext");
    expect(response).not.toHaveProperty("csrfHash");
  });
});
