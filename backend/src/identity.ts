import { USER_ROLES, type AuthenticatedUser, type UserRole } from "./types.js";

export interface IdTokenClaims {
  sub: string;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  exp: number;
  iat?: unknown;
  auth_time?: unknown;
  nonce?: unknown;
  "cognito:groups"?: unknown;
  [claim: string]: unknown;
}

export interface VerifiedIdentity {
  user: AuthenticatedUser;
  subject: string;
  authenticatedAt: number;
  tokenExpiresAt: number;
}

export function identityFromClaims(payload: IdTokenClaims): VerifiedIdentity {
  const issuedAt = payload.iat;
  const authenticatedAt = payload.auth_time;

  if (
    typeof issuedAt !== "number" ||
    !Number.isSafeInteger(issuedAt) ||
    typeof authenticatedAt !== "number" ||
    !Number.isSafeInteger(authenticatedAt) ||
    authenticatedAt < 0 ||
    authenticatedAt > issuedAt
  ) {
    throw new Error("A valid authentication time is required.");
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email || payload.email_verified !== true) {
    throw new Error("A verified email address is required.");
  }

  const rawGroups = payload["cognito:groups"];
  const groups = Array.isArray(rawGroups) ? rawGroups : [];
  const roles = groups.filter((group): group is UserRole =>
    typeof group === "string" && USER_ROLES.includes(group as UserRole),
  );

  if (roles.length === 0) {
    throw new Error("The user is not assigned to an application role.");
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  return {
    user: {
      id: payload.sub,
      email,
      displayName: name || email,
      roles: [...new Set(roles)],
    },
    subject: payload.sub,
    authenticatedAt,
    tokenExpiresAt: payload.exp,
  };
}
