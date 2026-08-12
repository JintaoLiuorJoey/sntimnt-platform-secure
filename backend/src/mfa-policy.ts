import { hasRecentAuthentication } from "./session.js";
import type { SessionRecord } from "./types.js";

export type TotpEnrollmentDecision =
  | "allow"
  | "forbidden"
  | "recent-authentication-required"
  | "token-refresh-required";

const ACCESS_TOKEN_EXPIRY_RESERVE_SECONDS = 30;

export function totpEnrollmentDecision(
  record: SessionRecord,
  now: number,
  recentAuthenticationMaxAgeSeconds: number,
): TotpEnrollmentDecision {
  if (!record.user.roles.includes("admin")) {
    return "forbidden";
  }

  if (record.adminMfaConfiguration !== "enrollment-required") {
    return "forbidden";
  }

  if (
    !hasRecentAuthentication(
      record,
      now,
      recentAuthenticationMaxAgeSeconds,
    )
  ) {
    return "recent-authentication-required";
  }

  if (
    !Number.isSafeInteger(record.tokenExpiresAt) ||
    record.tokenExpiresAt <=
      now + ACCESS_TOKEN_EXPIRY_RESERVE_SECONDS
  ) {
    return "token-refresh-required";
  }

  return "allow";
}
