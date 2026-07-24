import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { AuthConfig } from "./config.js";
import { cookieNames, parseCookies } from "./cookies.js";
import { requestOrigin } from "./http.js";
import { constantTimeEqual, sha256 } from "./security.js";
import type { SessionRecord } from "./types.js";

export function csrfIsValid(
  event: APIGatewayProxyEventV2,
  config: AuthConfig,
  session: SessionRecord,
): boolean {
  if (requestOrigin(event) !== config.appOrigin) return false;

  const headerToken = event.headers["x-csrf-token"];
  const cookieToken = parseCookies(event).get(cookieNames(config).csrf);
  if (!headerToken || !cookieToken) return false;
  if (!constantTimeEqual(headerToken, cookieToken)) return false;
  return constantTimeEqual(sha256(headerToken), session.csrfHash);
}
