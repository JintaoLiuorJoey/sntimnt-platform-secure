import type {
  CognitoUserMfaStatus,
} from "./cognito-mfa.js";
import type {
  AdminMfaConfigurationDecision,
  AuthenticatedUser,
} from "./types.js";

export type {
  AdminMfaConfigurationDecision,
} from "./types.js";

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
