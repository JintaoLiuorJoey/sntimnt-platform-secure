export const USER_ROLES = ["investor", "admin", "operations"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  roles: UserRole[];
}

export interface OAuthTransactionRecord {
  pk: string;
  kind: "oauth";
  bindingHash: string;
  verifierCiphertext: string;
  nonce: string;
  returnTo: string;
  expiresAt: number;
  ttl: number;
}

export interface SessionRecord {
  pk: string;
  kind: "session";
  user: AuthenticatedUser;
  refreshTokenCiphertext: string;
  csrfHash: string;
  subject: string;
  createdAt: number;
  lastSeenAt: number;
  absoluteExpiresAt: number;
  idleExpiresAt: number;
  tokenExpiresAt: number;
  ttl: number;
}

export interface RateLimitRecord {
  pk: string;
  kind: "rate";
  attemptCount: number;
  ttl: number;
}

export type AuthTableRecord = OAuthTransactionRecord | SessionRecord | RateLimitRecord;

export interface PublicSession {
  user: AuthenticatedUser;
  expiresAt: string;
  refreshAfter?: string;
}
