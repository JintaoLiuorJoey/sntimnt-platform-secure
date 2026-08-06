import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import { adminMfaConfigurationDecision } from "./admin-mfa-policy.js";
import { investorBusinessScope } from "./business-authorization.js";
import { getBusinessStore } from "./business-runtime.js";
import {
  clearAuthCookies,
  clearOAuthCookie,
  cookieNames,
  oauthCookie,
  parseCookies,
  sessionCookies,
} from "./cookies.js";
import { csrfIsValid } from "./csrf.js";
import {
  clientIp,
  emptyResponse,
  jsonResponse,
  rateLimitedResponse,
  redirectResponse,
} from "./http.js";
import { totpEnrollmentDecision } from "./mfa-policy.js";
import { parseTotpVerificationCode } from "./mfa-request.js";
import {
  constantTimeEqual,
  randomToken,
  safeInternalReturnTo,
  sha256,
} from "./security.js";
import {
  createSessionRecord,
  isSessionExpired,
  publicSession,
  rotateSessionRecord,
} from "./session.js";
import { createAuthRuntime } from "./runtime.js";
import type { SessionRecord } from "./types.js";

const {
  config,
  store,
  cipher,
  cognito,
  cognitoMfa,
} = createAuthRuntime();

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function currentAdminMfaConfiguration(
  user: SessionRecord["user"],
  accessToken: string,
) {
  if (!user.roles.includes("admin")) {
    return "not-required" as const;
  }

  return adminMfaConfigurationDecision(
    user,
    await cognitoMfa.getUserMfaStatus(
      accessToken,
    ),
  );
}

function appLoginUrl(reason: "authentication-failed" | "try-again-later"): string {
  const url = new URL("/login", `${config.appOrigin}/`);
  url.searchParams.set("reason", reason);
  return url.toString();
}

async function handleLogin(event: APIGatewayProxyEventV2) {
  const now = nowSeconds();
  const attempts = await store.incrementRateLimit(
    "login",
    clientIp(event),
    now,
    config.loginRateLimitWindowSeconds,
  );
  if (attempts > config.loginRateLimitCount) {
    return rateLimitedResponse(config.loginRateLimitWindowSeconds);
  }

  const state = randomToken();
  const nonce = randomToken();
  const codeVerifier = randomToken(48);
  const browserBinding = randomToken();
  const expiresAt = now + config.oauthTransactionTtlSeconds;
  const verifierCiphertext = await cipher.encrypt(
    codeVerifier,
    "oauth-pkce-verifier",
    state,
  );

  await store.putOAuthTransaction(state, {
    kind: "oauth",
    bindingHash: sha256(browserBinding),
    verifierCiphertext,
    nonce,
    returnTo: safeInternalReturnTo(event.queryStringParameters?.returnTo),
    expiresAt,
    ttl: expiresAt,
  });

  return redirectResponse(cognito.buildAuthorizeUrl(state, nonce, codeVerifier), [
    oauthCookie(config, browserBinding),
  ]);
}

async function handleCallback(event: APIGatewayProxyEventV2) {
  const state = event.queryStringParameters?.state;
  const code = event.queryStringParameters?.code;
  const callbackCookies = [clearOAuthCookie(config)];

  if (!state || !code || event.queryStringParameters?.error) {
    return redirectResponse(appLoginUrl("authentication-failed"), callbackCookies);
  }

  const transaction = await store.consumeOAuthTransaction(state);
  const browserBinding = parseCookies(event).get(cookieNames(config).oauth);
  const now = nowSeconds();

  if (
    !transaction ||
    transaction.expiresAt <= now ||
    !browserBinding ||
    !constantTimeEqual(transaction.bindingHash, sha256(browserBinding))
  ) {
    return redirectResponse(appLoginUrl("authentication-failed"), callbackCookies);
  }

  let issuedRefreshToken: string | undefined;

  try {
    const codeVerifier = await cipher.decrypt(
      transaction.verifierCiphertext,
      "oauth-pkce-verifier",
      state,
    );
    const tokens = await cognito.exchangeAuthorizationCode(code, codeVerifier);
    if (!tokens.refreshToken) throw new Error("Cognito did not return a refresh token.");
    issuedRefreshToken = tokens.refreshToken;

    const identity = await cognito.verifyIdentity(
      tokens.idToken,
      transaction.nonce,
    );

    const adminMfaConfiguration =
      await currentAdminMfaConfiguration(
        identity.user,
        tokens.accessToken,
      );

    const sessionId = randomToken();
    const csrfToken = randomToken();
    const refreshTokenCiphertext = await cipher.encrypt(
      tokens.refreshToken,
      "cognito-refresh-token",
      sessionId,
    );
    const accessTokenCiphertext = await cipher.encrypt(
      tokens.accessToken,
      "cognito-access-token",
      sessionId,
    );
    const record = createSessionRecord({
      config,
      now,
      user: identity.user,
      adminMfaConfiguration,
      subject: identity.subject,
      authenticatedAt: identity.authenticatedAt,
      refreshTokenCiphertext,
      accessTokenCiphertext,
      csrfHash: sha256(csrfToken),
      tokenExpiresAt: identity.tokenExpiresAt,
    });

    await store.putSession(sessionId, record);
    issuedRefreshToken = undefined;
    const maxAge = record.absoluteExpiresAt - now;
    const redirectUrl = new URL(transaction.returnTo, `${config.appOrigin}/`).toString();
    return redirectResponse(redirectUrl, [
      clearOAuthCookie(config),
      ...sessionCookies(config, sessionId, csrfToken, maxAge),
    ]);
  } catch {
    if (issuedRefreshToken) {
      await bestEffortRevoke(issuedRefreshToken, event.requestContext.requestId);
    }
    return redirectResponse(appLoginUrl("authentication-failed"), callbackCookies);
  }
}

async function bestEffortRevoke(
  refreshToken: string,
  requestId: string,
): Promise<void> {
  try {
    await cognito.revoke(refreshToken);
  } catch (error) {
    console.error("auth_revoke_failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function destroySession(
  sessionId: string,
  requestId: string,
): Promise<void> {
  const deleted = await store.deleteSession(sessionId);
  if (!deleted) return;

  try {
    const refreshToken = await cipher.decrypt(
      deleted.refreshTokenCiphertext,
      "cognito-refresh-token",
      sessionId,
    );
    await bestEffortRevoke(refreshToken, requestId);
  } catch (error) {
    console.error("auth_token_decrypt_failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

async function loadSession(event: APIGatewayProxyEventV2): Promise<{
  sessionId: string;
  record: SessionRecord;
} | null> {
  const sessionId = parseCookies(event).get(cookieNames(config).session);
  if (!sessionId) return null;

  const record = await store.getSession(sessionId);
  if (!record) return null;

  const now = nowSeconds();
  if (isSessionExpired(record, now)) {
    await destroySession(sessionId, event.requestContext.requestId);
    return null;
  }

  return { sessionId, record };
}

async function handleInvestmentAccounts(
  event: APIGatewayProxyEventV2,
) {
  try {
    const loaded =
      await loadSession(event);

    if (!loaded) {
      return jsonResponse(
        401,
        {
          message:
            "Authentication is required.",
        },
        clearAuthCookies(config),
      );
    }

    const authorization =
      investorBusinessScope(
        loaded.record,
      );

    if (
      authorization.status ===
      "authentication-required"
    ) {
      return jsonResponse(
        401,
        {
          message:
            "Authentication is required.",
        },
        clearAuthCookies(config),
      );
    }

    if (
      authorization.status ===
      "forbidden"
    ) {
      return jsonResponse(
        403,
        {
          message:
            "The requested resource is not permitted.",
        },
      );
    }

    const accounts =
      await getBusinessStore()
        .listInvestmentAccounts(
          authorization,
        );

    return jsonResponse(
      200,
      {
        accounts,
      },
    );
  } catch (error) {
    console.error(
      "business_investment_accounts_failed",
      {
        requestId:
          event.requestContext
            .requestId,
        errorName:
          error instanceof Error
            ? error.name
            : "UnknownError",
      },
    );

    return jsonResponse(
      503,
      {
        message:
          "Investment account data is temporarily unavailable.",
      },
    );
  }
}

async function handleSession(event: APIGatewayProxyEventV2) {
  const loaded = await loadSession(event);
  if (!loaded) {
    return jsonResponse(401, { message: "Authentication is required." }, clearAuthCookies(config));
  }

  const now = nowSeconds();
  const nextIdle = Math.min(
    loaded.record.absoluteExpiresAt,
    now + config.idleTtlSeconds,
  );
  const touched = await store.touchSession(
    loaded.sessionId,
    loaded.record,
    now,
    nextIdle,
  );
  if (!touched) {
    return jsonResponse(401, { message: "Authentication is required." }, clearAuthCookies(config));
  }

  return jsonResponse(200, publicSession(touched, now));
}

async function handleRefresh(event: APIGatewayProxyEventV2) {
  const loaded = await loadSession(event);
  if (!loaded) {
    return jsonResponse(401, { message: "Authentication is required." }, clearAuthCookies(config));
  }
  if (!csrfIsValid(event, config, loaded.record)) {
    return jsonResponse(403, { message: "The request could not be verified." });
  }

  const now = nowSeconds();
  let issuedRefreshToken: string | undefined;

  try {
    const oldRefreshToken = await cipher.decrypt(
      loaded.record.refreshTokenCiphertext,
      "cognito-refresh-token",
      loaded.sessionId,
    );
    const tokens = await cognito.refresh(oldRefreshToken);
    issuedRefreshToken = tokens.refreshToken;

    const identity = await cognito.verifyIdentity(
      tokens.idToken,
      undefined,
      loaded.record.subject,
    );

    const adminMfaConfiguration =
      await currentAdminMfaConfiguration(
        identity.user,
        tokens.accessToken,
      );

    const nextRefreshToken =
      tokens.refreshToken ??
      oldRefreshToken;
    const nextSessionId = randomToken();
    const nextCsrfToken = randomToken();
    const nextRefreshTokenCiphertext = await cipher.encrypt(
      nextRefreshToken,
      "cognito-refresh-token",
      nextSessionId,
    );
    const nextAccessTokenCiphertext = await cipher.encrypt(
      tokens.accessToken,
      "cognito-access-token",
      nextSessionId,
    );
    const nextRecord = rotateSessionRecord({
      config,
      existing: loaded.record,
      now,
      user: identity.user,
      adminMfaConfiguration,
      refreshTokenCiphertext: nextRefreshTokenCiphertext,
      accessTokenCiphertext: nextAccessTokenCiphertext,
      csrfHash: sha256(nextCsrfToken),
      tokenExpiresAt: identity.tokenExpiresAt,
    });

    await store.rotateSession(loaded.sessionId, nextSessionId, nextRecord);
    issuedRefreshToken = undefined;
    const maxAge = nextRecord.absoluteExpiresAt - now;
    return jsonResponse(
      200,
      publicSession({ ...nextRecord, pk: "redacted" }, now),
      sessionCookies(config, nextSessionId, nextCsrfToken, maxAge),
    );
  } catch {
    if (issuedRefreshToken) {
      await bestEffortRevoke(issuedRefreshToken, event.requestContext.requestId);
    }
    await destroySession(loaded.sessionId, event.requestContext.requestId);
    return jsonResponse(401, { message: "Authentication is required." }, clearAuthCookies(config));
  }
}

type TotpAuthorization =
  | {
      loaded: {
        sessionId: string;
        record: SessionRecord;
      };
    }
  | {
      response: APIGatewayProxyStructuredResultV2;
    };

type TotpAccessToken =
  | {
      accessToken: string;
    }
  | {
      response: APIGatewayProxyStructuredResultV2;
    };

function cognitoAccessTokenWasRejected(
  error: unknown,
): boolean {
  return (
    error instanceof Error &&
    (
      error.name === "NotAuthorizedException" ||
      error.name === "UserNotFoundException"
    )
  );
}

function cognitoTotpCodeWasRejected(
  error: unknown,
): boolean {
  return (
    error instanceof Error &&
    error.name === "CodeMismatchException"
  );
}

async function authorizeTotpRequest(
  event: APIGatewayProxyEventV2,
): Promise<TotpAuthorization> {
  const loaded = await loadSession(event);

  if (!loaded) {
    return {
      response: jsonResponse(
        401,
        { message: "Authentication is required." },
        clearAuthCookies(config),
      ),
    };
  }

  if (!csrfIsValid(event, config, loaded.record)) {
    return {
      response: jsonResponse(
        403,
        {
          message:
            "The request could not be verified.",
        },
      ),
    };
  }

  const decision = totpEnrollmentDecision(
    loaded.record,
    nowSeconds(),
    config.recentAuthenticationMaxAgeSeconds,
  );

  if (decision === "forbidden") {
    return {
      response: jsonResponse(
        403,
        {
          message:
            "The requested operation is not permitted.",
        },
      ),
    };
  }

  if (
    decision ===
    "recent-authentication-required"
  ) {
    return {
      response: jsonResponse(
        403,
        {
          message:
            "Recent authentication is required.",
        },
      ),
    };
  }

  if (decision === "token-refresh-required") {
    return {
      response: jsonResponse(
        409,
        {
          message:
            "Refresh the session before continuing MFA enrollment.",
        },
      ),
    };
  }

  return { loaded };
}

async function decryptTotpAccessToken(
  loaded: {
    sessionId: string;
    record: SessionRecord;
  },
  requestId: string,
): Promise<TotpAccessToken> {
  try {
    return {
      accessToken: await cipher.decrypt(
        loaded.record.accessTokenCiphertext,
        "cognito-access-token",
        loaded.sessionId,
      ),
    };
  } catch {
    await destroySession(
      loaded.sessionId,
      requestId,
    );

    return {
      response: jsonResponse(
        401,
        { message: "Authentication is required." },
        clearAuthCookies(config),
      ),
    };
  }
}

async function invalidateRejectedCognitoSession(
  loaded: {
    sessionId: string;
    record: SessionRecord;
  },
  requestId: string,
): Promise<APIGatewayProxyStructuredResultV2> {
  await destroySession(
    loaded.sessionId,
    requestId,
  );

  return jsonResponse(
    401,
    { message: "Authentication is required." },
    clearAuthCookies(config),
  );
}

async function handleTotpEnrollmentStart(
  event: APIGatewayProxyEventV2,
) {
  const authorization =
    await authorizeTotpRequest(event);

  if ("response" in authorization) {
    return authorization.response;
  }

  const token = await decryptTotpAccessToken(
    authorization.loaded,
    event.requestContext.requestId,
  );

  if ("response" in token) {
    return token.response;
  }

  try {
    const { secretCode } =
      await cognitoMfa.startTotpEnrollment(
        token.accessToken,
      );

    return jsonResponse(200, { secretCode });
  } catch (error) {
    if (cognitoAccessTokenWasRejected(error)) {
      return invalidateRejectedCognitoSession(
        authorization.loaded,
        event.requestContext.requestId,
      );
    }

    console.error(
      "auth_totp_enrollment_start_failed",
      {
        requestId:
          event.requestContext.requestId,
        errorName:
          error instanceof Error
            ? error.name
            : "UnknownError",
      },
    );

    return jsonResponse(
      503,
      {
        message:
          "MFA enrollment is temporarily unavailable.",
      },
    );
  }
}

async function handleTotpEnrollmentComplete(
  event: APIGatewayProxyEventV2,
) {
  const authorization =
    await authorizeTotpRequest(event);

  if ("response" in authorization) {
    return authorization.response;
  }

  const userCode = parseTotpVerificationCode(
    event.body,
    event.isBase64Encoded === true,
  );

  if (!userCode) {
    return jsonResponse(
      400,
      {
        message:
          "A valid six-digit verification code is required.",
      },
    );
  }

  const token = await decryptTotpAccessToken(
    authorization.loaded,
    event.requestContext.requestId,
  );

  if ("response" in token) {
    return token.response;
  }

  let cognitoConfigured = false;

  try {
    await cognitoMfa.completeTotpEnrollment(
      token.accessToken,
      userCode,
    );

    cognitoConfigured = true;

    const configuredSession =
      await store.markAdminMfaConfigured(
        authorization.loaded.sessionId,
        authorization.loaded.record,
        nowSeconds(),
      );

    if (!configuredSession) {
      return invalidateRejectedCognitoSession(
        authorization.loaded,
        event.requestContext.requestId,
      );
    }

    return emptyResponse(204);
  } catch (error) {
    if (cognitoConfigured) {
      return invalidateRejectedCognitoSession(
        authorization.loaded,
        event.requestContext.requestId,
      );
    }
    if (cognitoTotpCodeWasRejected(error)) {
      return jsonResponse(
        400,
        {
          message:
            "The verification code was not accepted.",
        },
      );
    }

    if (cognitoAccessTokenWasRejected(error)) {
      return invalidateRejectedCognitoSession(
        authorization.loaded,
        event.requestContext.requestId,
      );
    }

    console.error(
      "auth_totp_enrollment_complete_failed",
      {
        requestId:
          event.requestContext.requestId,
        errorName:
          error instanceof Error
            ? error.name
            : "UnknownError",
      },
    );

    return jsonResponse(
      503,
      {
        message:
          "MFA enrollment is temporarily unavailable.",
      },
    );
  }
}

async function handleLogout(event: APIGatewayProxyEventV2) {
  const loaded = await loadSession(event);
  if (!loaded) return emptyResponse(204, clearAuthCookies(config));
  if (!csrfIsValid(event, config, loaded.record)) {
    return jsonResponse(403, { message: "The request could not be verified." });
  }

  await destroySession(loaded.sessionId, event.requestContext.requestId);

  return emptyResponse(204, clearAuthCookies(config));
}

async function route(event: APIGatewayProxyEventV2) {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;

  if (
    method === "GET" &&
    path === "/api/me/investment-accounts"
  ) {
    return handleInvestmentAccounts(
      event,
    );
  }

  if (method === "GET" && path === "/api/auth/login") return handleLogin(event);
  if (method === "GET" && path === "/api/auth/callback") return handleCallback(event);
  if (method === "GET" && path === "/api/auth/session") return handleSession(event);
  if (method === "POST" && path === "/api/auth/refresh") return handleRefresh(event);
  if (
    method === "POST" &&
    path === "/api/auth/mfa/totp/start"
  ) {
    return handleTotpEnrollmentStart(event);
  }
  if (
    method === "POST" &&
    path === "/api/auth/mfa/totp/complete"
  ) {
    return handleTotpEnrollmentComplete(event);
  }
  if (method === "POST" && path === "/api/auth/logout") return handleLogout(event);

  return jsonResponse(404, { message: "Not found." });
}

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    return await route(event);
  } catch (error) {
    console.error("auth_request_failed", {
      requestId: context.awsRequestId,
      routeKey: event.routeKey,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonResponse(500, { message: "The authentication service is temporarily unavailable." });
  }
}
