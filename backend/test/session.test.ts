import { describe, expect, it } from "vitest";
import type { AuthConfig } from "../src/config.js";
import {
  createSessionRecord,
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

describe("server-side session lifecycle", () => {
  it("enforces separate absolute and idle deadlines", () => {
    const record = createSessionRecord({
      config,
      now: 1_000,
      user,
      subject: "user-1",
      refreshTokenCiphertext: "ciphertext",
      csrfHash: "hash",
      tokenExpiresAt: 4_600,
    });

    expect(record.absoluteExpiresAt).toBe(29_800);
    expect(record.idleExpiresAt).toBe(2_800);
    expect(isSessionExpired({ ...record, pk: "pk" }, 2_799)).toBe(false);
    expect(isSessionExpired({ ...record, pk: "pk" }, 2_800)).toBe(true);
  });

  it("rotates session state without extending the absolute timeout", () => {
    const existing = {
      ...createSessionRecord({
        config,
        now: 1_000,
        user,
        subject: "user-1",
        refreshTokenCiphertext: "old",
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
      csrfHash: "new-hash",
      tokenExpiresAt: 5_600,
    });

    expect(rotated.absoluteExpiresAt).toBe(existing.absoluteExpiresAt);
    expect(rotated.idleExpiresAt).toBe(3_800);
    expect(rotated.refreshTokenCiphertext).toBe("new");
  });

  it("returns only public identity and timing data", () => {
    const record = {
      ...createSessionRecord({
        config,
        now: 1_000,
        user,
        subject: "user-1",
        refreshTokenCiphertext: "secret-token",
        csrfHash: "secret-hash",
        tokenExpiresAt: 4_600,
      }),
      pk: "pk",
    } satisfies SessionRecord;

    const response = publicSession(record, 1_000);
    expect(response.user).toEqual(user);
    expect(response).not.toHaveProperty("refreshTokenCiphertext");
    expect(response).not.toHaveProperty("csrfHash");
  });
});
