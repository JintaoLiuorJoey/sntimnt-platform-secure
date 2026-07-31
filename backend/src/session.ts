import type { AuthConfig } from "./config.js";
import type {
  AdminMfaConfigurationDecision,
  AuthenticatedUser,
  PublicSession,
  SessionRecord,
} from "./types.js";

function adminMfaConfigurationMatchesUser(
  user: AuthenticatedUser,
  decision: unknown,
): decision is AdminMfaConfigurationDecision {
  if (user.roles.includes("admin")) {
    return (
      decision === "enrollment-required" ||
      decision === "configured"
    );
  }

  return decision === "not-required";
}

function resolveAdminMfaConfiguration(
  user: AuthenticatedUser,
  decision:
    | AdminMfaConfigurationDecision
    | undefined,
): AdminMfaConfigurationDecision {
  const resolved =
    decision ??
    (user.roles.includes("admin")
      ? "enrollment-required"
      : "not-required");

  if (
    !adminMfaConfigurationMatchesUser(
      user,
      resolved,
    )
  ) {
    throw new Error(
      "Administrator MFA configuration does not match the session roles.",
    );
  }

  return resolved;
}

export function createSessionRecord(input: {
  config: AuthConfig;
  now: number;
  user: AuthenticatedUser;
  adminMfaConfiguration?: AdminMfaConfigurationDecision;
  subject: string;
  authenticatedAt: number;
  refreshTokenCiphertext: string;
  accessTokenCiphertext: string;
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
    adminMfaConfiguration:
      resolveAdminMfaConfiguration(
        input.user,
        input.adminMfaConfiguration,
      ),
    refreshTokenCiphertext: input.refreshTokenCiphertext,
    accessTokenCiphertext: input.accessTokenCiphertext,
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
  adminMfaConfiguration?: AdminMfaConfigurationDecision;
  refreshTokenCiphertext: string;
  accessTokenCiphertext: string;
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
    adminMfaConfiguration:
      resolveAdminMfaConfiguration(
        input.user,
        input.adminMfaConfiguration ??
          input.existing.adminMfaConfiguration,
      ),
    refreshTokenCiphertext: input.refreshTokenCiphertext,
    accessTokenCiphertext: input.accessTokenCiphertext,
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

function sessionCiphertextsAreValid(record: SessionRecord): boolean {
  return (
    typeof record.refreshTokenCiphertext === "string" &&
    record.refreshTokenCiphertext.length > 0 &&
    record.refreshTokenCiphertext.trim() ===
      record.refreshTokenCiphertext &&
    typeof record.accessTokenCiphertext === "string" &&
    record.accessTokenCiphertext.length > 0 &&
    record.accessTokenCiphertext.trim() ===
      record.accessTokenCiphertext
  );
}

function authenticationTimeIsValid(record: SessionRecord): boolean {
  return (
    Number.isSafeInteger(record.createdAt) &&
    record.createdAt >= 0 &&
    Number.isSafeInteger(record.authenticatedAt) &&
    record.authenticatedAt >= 0 &&
    record.authenticatedAt <= record.createdAt + 60
  );
}

export function isSessionExpired(record: SessionRecord, now: number): boolean {
  return (
    !adminMfaConfigurationMatchesUser(
      record.user,
      record.adminMfaConfiguration,
    ) ||
    !sessionCiphertextsAreValid(record) ||
    !authenticationTimeIsValid(record) ||
    record.absoluteExpiresAt <= now ||
    record.idleExpiresAt <= now
  );
}

export function hasRecentAuthentication(
  record: SessionRecord,
  now: number,
  maxAgeSeconds: number,
): boolean {
  if (
    !authenticationTimeIsValid(record) ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds <= 0 ||
    record.createdAt > now + 60 ||
    record.authenticatedAt > now + 60
  ) {
    return false;
  }

  const authenticationAge = now - Math.min(record.authenticatedAt, now);
  return authenticationAge <= maxAgeSeconds;
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
