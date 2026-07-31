import type {
  CognitoUserMfaStatus,
} from "./cognito-mfa.js";
import type {
  AuthenticatedUser,
} from "./types.js";

export type AdminMfaConfigurationDecision =
  | "not-required"
  | "enrollment-required"
  | "configured";

export function adminMfaConfigurationDecision(
  user: AuthenticatedUser,
  status: CognitoUserMfaStatus,
): AdminMfaConfigurationDecision {
  if (!user.roles.includes("admin")) {
    return "not-required";
  }

  if (
    status.softwareTokenMfaEnabled &&
    status.softwareTokenMfaPreferred
  ) {
    return "configured";
  }

  return "enrollment-required";
}
