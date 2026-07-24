import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import { loadConfig } from "./config.js";
import {
  clearAuthCookies,
  clearOAuthCookie,
  cookieNames,
  oauthCookie,
  parseCookies,
  sessionCookies,
} from "./cookies.js";
import { CognitoService } from "./cognito.js";
import { csrfIsValid } from "./csrf.js";
import {
  clientIp,
  emptyResponse,
  jsonResponse,
  rateLimitedResponse,
  redirectResponse,
} from "./http.js";
import { KmsCipher } from "./kms-cipher.js";
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
import { AuthStore } from "./store.js";
import type { SessionRecord } from "./types.js";

const config = loadConfig();
const store = new AuthStore(config);
const cipher = new KmsCipher(config);
const cognito = new CognitoService(config);

const nowSeconds = () => Math.floor(Date.now() / 1000);

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
    const sessionId = randomToken();
    const csrfToken = randomToken();
    const refreshTokenCiphertext = await cipher.encrypt(
      tokens.refreshToken,
      "cognito-refresh-token",
      sessionId,
    );
    const record = createSessionRecord({
      config,
      now,
      user: identity.user,
      subject: identity.subject,
      refreshTokenCiphertext,
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
    const identity = await cognito.verifyIdentity(
      tokens.idToken,
      undefined,
      loaded.record.subject,
    );
    const nextRefreshToken = tokens.refreshToken ?? oldRefreshToken;
    issuedRefreshToken = tokens.refreshToken;
    const nextSessionId = randomToken();
    const nextCsrfToken = randomToken();
    const nextCiphertext = await cipher.encrypt(
      nextRefreshToken,
      "cognito-refresh-token",
      nextSessionId,
    );
    const nextRecord = rotateSessionRecord({
      config,
      existing: loaded.record,
      now,
      user: identity.user,
      refreshTokenCiphertext: nextCiphertext,
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

  if (method === "GET" && path === "/api/auth/login") return handleLogin(event);
  if (method === "GET" && path === "/api/auth/callback") return handleCallback(event);
  if (method === "GET" && path === "/api/auth/session") return handleSession(event);
  if (method === "POST" && path === "/api/auth/refresh") return handleRefresh(event);
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
