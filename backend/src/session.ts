import type { AuthConfig } from "./config.js";
import type {
  AuthenticatedUser,
  PublicSession,
  SessionRecord,
} from "./types.js";

export function createSessionRecord(input: {
  config: AuthConfig;
  now: number;
  user: AuthenticatedUser;
  subject: string;
  authenticatedAt: number;
  refreshTokenCiphertext: string;
  csrfHash: string;
  tokenExpiresAt: number;
}): Omit<SessionRecord, "pk"> {
  const absoluteExpiresAt = input.now + input.config.absoluteTtlSeconds;
  const idleExpiresAt = Math.min(
    absoluteExpiresAt,
    input.now + input.config.idleTtlSeconds,
  );

  return {
    kind: "session",
    user: input.user,
    refreshTokenCiphertext: input.refreshTokenCiphertext,
    csrfHash: input.csrfHash,
    subject: input.subject,
    authenticatedAt: input.authenticatedAt,
    createdAt: input.now,
    lastSeenAt: input.now,
    absoluteExpiresAt,
    idleExpiresAt,
    tokenExpiresAt: input.tokenExpiresAt,
    ttl: absoluteExpiresAt,
  };
}

export function rotateSessionRecord(input: {
  config: AuthConfig;
  existing: SessionRecord;
  now: number;
  user: AuthenticatedUser;
  refreshTokenCiphertext: string;
  csrfHash: string;
  tokenExpiresAt: number;
}): Omit<SessionRecord, "pk"> {
  const idleExpiresAt = Math.min(
    input.existing.absoluteExpiresAt,
    input.now + input.config.idleTtlSeconds,
  );

  return {
    kind: "session",
    user: input.user,
    refreshTokenCiphertext: input.refreshTokenCiphertext,
    csrfHash: input.csrfHash,
    subject: input.existing.subject,
    authenticatedAt: input.existing.authenticatedAt,
    createdAt: input.existing.createdAt,
    lastSeenAt: input.now,
    absoluteExpiresAt: input.existing.absoluteExpiresAt,
    idleExpiresAt,
    tokenExpiresAt: input.tokenExpiresAt,
    ttl: input.existing.absoluteExpiresAt,
  };
}

export function isSessionExpired(record: SessionRecord, now: number): boolean {
  const authenticationTimeIsValid =
    Number.isSafeInteger(record.authenticatedAt) &&
    record.authenticatedAt >= 0 &&
    record.authenticatedAt <= record.createdAt + 60;

  return (
    !authenticationTimeIsValid ||
    record.absoluteExpiresAt <= now ||
    record.idleExpiresAt <= now
  );
}

export function effectiveExpiresAt(record: SessionRecord): number {
  return Math.min(record.absoluteExpiresAt, record.idleExpiresAt);
}

export function publicSession(record: SessionRecord, now: number): PublicSession {
  const expiresAt = effectiveExpiresAt(record);
  const refreshAt = Math.min(
    record.tokenExpiresAt - 300,
    record.idleExpiresAt - 300,
    now + 900,
  );

  return {
    user: record.user,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    ...(refreshAt > now + 5
      ? { refreshAfter: new Date(refreshAt * 1000).toISOString() }
      : {}),
  };
}
