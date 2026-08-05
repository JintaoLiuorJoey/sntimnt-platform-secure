import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { sha256 } from "../src/security.js";
import type {
  AuthenticatedUser,
  OAuthTransactionRecord,
  SessionRecord,
} from "../src/types.js";

const NOW = 2_000_000_000;
const APP_ORIGIN =
  "https://app.example.com";
const SESSION_ID =
  "current-session-id";
const CSRF_TOKEN =
  "csrf-token";
const OAUTH_STATE =
  "oauth-state";
const OAUTH_BINDING =
  "oauth-browser-binding";

const adminUser: AuthenticatedUser = {
  id: "admin-1",
  email: "admin@example.com",
  displayName: "Administrator",
  roles: ["admin"],
};

const investorUser: AuthenticatedUser = {
  id: "investor-1",
  email: "investor@example.com",
  displayName: "Investor",
  roles: ["investor"],
};

const formerAdminInvestor:
  AuthenticatedUser = {
    id: "admin-1",
    email: "admin@example.com",
    displayName: "Administrator",
    roles: ["investor"],
  };

const runtime = vi.hoisted(() => ({
  config: {
    appOrigin:
      "https://app.example.com",
    cookieSecure: true,
    absoluteTtlSeconds: 28_800,
    idleTtlSeconds: 1_800,
    oauthTransactionTtlSeconds:
      600,
    loginRateLimitCount: 20,
    loginRateLimitWindowSeconds:
      300,
  },
  store: {
    incrementRateLimit:
      vi.fn(),
    putOAuthTransaction:
      vi.fn(),
    consumeOAuthTransaction:
      vi.fn(),
    putSession:
      vi.fn(),
    getSession:
      vi.fn(),
    touchSession:
      vi.fn(),
    rotateSession:
      vi.fn(),
    deleteSession:
      vi.fn(),
  },
  cipher: {
    decrypt:
      vi.fn(),
    encrypt:
      vi.fn(),
  },
  cognito: {
    buildAuthorizeUrl:
      vi.fn(),
    exchangeAuthorizationCode:
      vi.fn(),
    verifyIdentity:
      vi.fn(),
    refresh:
      vi.fn(),
    revoke:
      vi.fn(),
  },
  cognitoMfa: {
    getUserMfaStatus:
      vi.fn(),
  },
}));

vi.mock("../src/runtime.js", () => ({
  createAuthRuntime: () => runtime,
}));

let invokeHandler: (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<
  APIGatewayProxyStructuredResultV2
>;

const context = {
  awsRequestId: "request-id",
} as Context;

function identity(
  user: AuthenticatedUser,
) {
  return {
    user,
    subject: user.id,
    authenticatedAt:
      NOW - 60,
    tokenExpiresAt:
      NOW + 3_600,
  };
}

function oauthTransaction(
  overrides:
    Partial<OAuthTransactionRecord> = {},
): OAuthTransactionRecord {
  return {
    pk:
      "AUTH#OAUTH#" +
      OAUTH_STATE,
    kind: "oauth",
    bindingHash:
      sha256(OAUTH_BINDING),
    verifierCiphertext:
      "pkce-verifier-ciphertext",
    nonce: "oauth-nonce",
    returnTo: "/dashboard",
    expiresAt: NOW + 600,
    ttl: NOW + 600,
    ...overrides,
  };
}

function session(
  overrides:
    Partial<SessionRecord> = {},
): SessionRecord {
  return {
    pk:
      "AUTH#SESSION#current",
    kind: "session",
    user: adminUser,
    adminMfaConfiguration:
      "enrollment-required",
    refreshTokenCiphertext:
      "old-refresh-ciphertext",
    accessTokenCiphertext:
      "old-access-ciphertext",
    csrfHash:
      sha256(CSRF_TOKEN),
    subject: "admin-1",
    authenticatedAt:
      NOW - 120,
    createdAt:
      NOW - 120,
    lastSeenAt:
      NOW - 60,
    absoluteExpiresAt:
      NOW + 7_200,
    idleExpiresAt:
      NOW + 1_800,
    tokenExpiresAt:
      NOW + 600,
    ttl:
      NOW + 7_200,
    ...overrides,
  };
}

function loginEvent(
  returnTo?: string,
): APIGatewayProxyEventV2 {
  return event(
    "GET",
    "/api/auth/login",
    returnTo
      ? {
          queryStringParameters: {
            returnTo,
          },
        }
      : {},
  );
}

function callbackEvent(
  input: {
    state?: string | null;
    code?: string | null;
    error?: string;
    binding?: string | null;
  } = {},
): APIGatewayProxyEventV2 {
  const state =
    input.state === undefined
      ? OAUTH_STATE
      : input.state;

  const code =
    input.code === undefined
      ? "authorization-code"
      : input.code;

  const binding =
    input.binding === undefined
      ? OAUTH_BINDING
      : input.binding;

  const queryStringParameters:
    Record<string, string> = {};

  if (state !== null) {
    queryStringParameters.state =
      state;
  }

  if (code !== null) {
    queryStringParameters.code =
      code;
  }

  if (input.error !== undefined) {
    queryStringParameters.error =
      input.error;
  }

  return event(
    "GET",
    "/api/auth/callback",
    {
      cookies:
        binding === null
          ? []
          : [
              "__Host-sntimnt_oauth=" +
                binding,
            ],
      queryStringParameters,
    },
  );
}

function refreshEvent(
  input: {
    authenticated?: boolean;
    csrf?: boolean;
  } = {},
): APIGatewayProxyEventV2 {
  const authenticated =
    input.authenticated ?? true;

  const csrf =
    input.csrf ?? true;

  return event(
    "POST",
    "/api/auth/refresh",
    {
      cookies: authenticated
        ? [
            "__Host-sntimnt_session=" +
              SESSION_ID,
            "__Host-sntimnt_csrf=" +
              CSRF_TOKEN,
          ]
        : [],
      headers: csrf
        ? {
            origin: APP_ORIGIN,
            "x-csrf-token":
              CSRF_TOKEN,
          }
        : {
            origin: APP_ORIGIN,
          },
    },
  );
}

function sessionEvent(
  authenticated = true,
): APIGatewayProxyEventV2 {
  return event(
    "GET",
    "/api/auth/session",
    {
      cookies: authenticated
        ? [
            "__Host-sntimnt_session=" +
              SESSION_ID,
          ]
        : [],
    },
  );
}

function logoutEvent(
  input: {
    authenticated?: boolean;
    csrf?: boolean;
  } = {},
): APIGatewayProxyEventV2 {
  const authenticated =
    input.authenticated ?? true;

  const csrf =
    input.csrf ?? true;

  return event(
    "POST",
    "/api/auth/logout",
    {
      cookies: authenticated
        ? [
            "__Host-sntimnt_session=" +
              SESSION_ID,
            "__Host-sntimnt_csrf=" +
              CSRF_TOKEN,
          ]
        : [],
      headers: csrf
        ? {
            origin:
              APP_ORIGIN,
            "x-csrf-token":
              CSRF_TOKEN,
          }
        : {
            origin:
              APP_ORIGIN,
          },
    },
  );
}

function event(
  method: string,
  path: string,
  input: {
    cookies?: string[];
    headers?:
      Record<string, string>;
    queryStringParameters?:
      Record<string, string>;
  } = {},
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey:
      method + " " + path,
    rawPath: path,
    rawQueryString: "",
    headers:
      input.headers ?? {
        origin: APP_ORIGIN,
      },
    cookies:
      input.cookies ?? [],
    requestContext: {
      accountId:
        "123456789012",
      apiId: "api-id",
      domainName:
        "app.example.com",
      domainPrefix: "app",
      http: {
        method,
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "request-id",
      routeKey:
        method + " " + path,
      stage: "$default",
      time:
        "01/Jan/2033:00:00:00 +0000",
      timeEpoch:
        NOW * 1_000,
    },
    ...(input.queryStringParameters
      ? {
          queryStringParameters:
            input.queryStringParameters,
        }
      : {}),
    isBase64Encoded: false,
  };
}

function responseBody(
  response:
    APIGatewayProxyStructuredResultV2,
): Record<string, unknown> {
  return JSON.parse(
    response.body ?? "{}",
  ) as Record<string, unknown>;
}

function responseLocation(
  response:
    APIGatewayProxyStructuredResultV2,
): URL {
  const location =
    Object.entries(
      response.headers ?? {},
    ).find(
      ([name]) =>
        name.toLowerCase() ===
        "location",
    )?.[1];

  if (
    typeof location !== "string"
  ) {
    throw new Error(
      "Expected a redirect location.",
    );
  }

  return new URL(location);
}

function expectClearedOAuthCookie(
  response:
    APIGatewayProxyStructuredResultV2,
): void {
  const cookies =
    response.cookies ?? [];

  expect(cookies).toHaveLength(1);

  const cookie =
    cookies[0];

  if (!cookie) {
    throw new Error(
      "Expected a cleared OAuth cookie.",
    );
  }

  expect(
    cookie.startsWith(
      "__Host-sntimnt_oauth=",
    ),
  ).toBe(true);

  expect(cookie).toContain(
    "Max-Age=0",
  );

  expect(cookie).toContain(
    "Path=/",
  );

  expect(cookie).toContain(
    "SameSite=Lax",
  );

  expect(cookie).toContain(
    "Secure",
  );

  expect(cookie).toContain(
    "HttpOnly",
  );
}

function expectAuthenticationFailedRedirect(
  response:
    APIGatewayProxyStructuredResultV2,
): void {
  expect(
    response.statusCode,
  ).toBe(303);

  expect(
    response.body,
  ).toBe("");

  const location =
    responseLocation(
      response,
    );

  expect(
    location.origin,
  ).toBe(APP_ORIGIN);

  expect(
    location.pathname,
  ).toBe("/login");

  expect(
    location.searchParams.get(
      "reason",
    ),
  ).toBe(
    "authentication-failed",
  );

  expectClearedOAuthCookie(
    response,
  );
}

function expectClearedCookies(
  response:
    APIGatewayProxyStructuredResultV2,
): void {
  const cookies =
    response.cookies ?? [];

  expect(cookies).toHaveLength(3);

  expect(
    cookies.every((cookie) =>
      cookie.includes(
        "Max-Age=0",
      ),
    ),
  ).toBe(true);
}

beforeAll(async () => {
  const module =
    await import(
      "../src/handler.js"
    );

  invokeHandler =
    module.handler;
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(
    new Date(NOW * 1_000),
  );

  runtime.store
    .incrementRateLimit
    .mockReset()
    .mockResolvedValue(1);

  runtime.store
    .putOAuthTransaction
    .mockReset()
    .mockResolvedValue(
      undefined,
    );

  runtime.store
    .consumeOAuthTransaction
    .mockReset()
    .mockResolvedValue(
      oauthTransaction(),
    );

  runtime.store.putSession
    .mockReset()
    .mockResolvedValue(
      undefined,
    );

  runtime.store.getSession
    .mockReset()
    .mockResolvedValue(
      session(),
    );

  runtime.store.touchSession
    .mockReset()
    .mockResolvedValue(
      session({
        lastSeenAt: NOW,
        idleExpiresAt:
          NOW + 1_800,
      }),
    );

  runtime.store.rotateSession
    .mockReset()
    .mockResolvedValue(
      undefined,
    );

  runtime.store.deleteSession
    .mockReset()
    .mockResolvedValue(
      null,
    );

  runtime.cipher.decrypt
    .mockReset()
    .mockResolvedValue(
      "decrypted-secret",
    );

  runtime.cipher.encrypt
    .mockReset()
    .mockImplementation(
      async (
        _plaintext: string,
        purpose: string,
      ) =>
        purpose +
        "-ciphertext",
    );

  runtime.cognito
    .buildAuthorizeUrl
    .mockReset()
    .mockImplementation(
      (
        state: string,
        nonce: string,
        codeVerifier: string,
      ) => {
        const url =
          new URL(
            "https://auth.example.com/oauth2/authorize",
          );

        url.searchParams.set(
          "state",
          state,
        );

        url.searchParams.set(
          "nonce",
          nonce,
        );

        url.searchParams.set(
          "code_verifier",
          codeVerifier,
        );

        return url.toString();
      },
    );

  runtime.cognito
    .exchangeAuthorizationCode
    .mockReset()
    .mockResolvedValue({
      idToken: "id-token",
      accessToken:
        "access-token",
      refreshToken:
        "refresh-token",
      expiresIn: 3_600,
    });

  runtime.cognito
    .verifyIdentity
    .mockReset()
    .mockResolvedValue(
      identity(adminUser),
    );

  runtime.cognito.refresh
    .mockReset()
    .mockResolvedValue({
      idToken:
        "next-id-token",
      accessToken:
        "next-access-token",
      refreshToken:
        "next-refresh-token",
      expiresIn: 3_600,
    });

  runtime.cognito.revoke
    .mockReset()
    .mockResolvedValue(
      undefined,
    );

  runtime.cognitoMfa
    .getUserMfaStatus
    .mockReset()
    .mockResolvedValue({
      softwareTokenMfaEnabled:
        true,
      softwareTokenMfaPreferred:
        true,
    });

  vi.spyOn(
    console,
    "error",
  ).mockImplementation(
    () => undefined,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe(
  "authentication session lifecycle",
  () => {


    it("creates a browser-bound OAuth transaction at the login rate-limit boundary", async () => {
      runtime.store
        .incrementRateLimit
        .mockResolvedValueOnce(20);

      const response =
        await invokeHandler(
          loginEvent(
            "/portfolio?tab=active",
          ),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(303);

      expect(
        response.body,
      ).toBe("");

      expect(
        runtime.store
          .incrementRateLimit,
      ).toHaveBeenCalledWith(
        "login",
        "127.0.0.1",
        NOW,
        300,
      );

      expect(
        runtime.cipher.encrypt,
      ).toHaveBeenCalledTimes(1);

      const encryptCall =
        runtime.cipher.encrypt
          .mock.calls[0];

      const codeVerifier =
        encryptCall?.[0] as
          | string
          | undefined;

      const state =
        encryptCall?.[2] as
          | string
          | undefined;

      expect(
        codeVerifier,
      ).toEqual(
        expect.any(String),
      );

      expect(
        codeVerifier?.length,
      ).toBeGreaterThan(30);

      expect(
        encryptCall?.[1],
      ).toBe(
        "oauth-pkce-verifier",
      );

      expect(
        state,
      ).toEqual(
        expect.any(String),
      );

      expect(
        runtime.store
          .putOAuthTransaction,
      ).toHaveBeenCalledTimes(1);

      const transactionCall =
        runtime.store
          .putOAuthTransaction
          .mock.calls[0];

      const storedState =
        transactionCall?.[0] as
          | string
          | undefined;

      const transaction =
        transactionCall?.[1] as
          | Omit<
              OAuthTransactionRecord,
              "pk"
            >
          | undefined;

      expect(
        storedState,
      ).toBe(state);

      expect(
        transaction,
      ).toEqual({
        kind: "oauth",
        bindingHash:
          expect.any(String),
        verifierCiphertext:
          "oauth-pkce-verifier-ciphertext",
        nonce:
          expect.any(String),
        returnTo:
          "/portfolio?tab=active",
        expiresAt:
          NOW + 600,
        ttl:
          NOW + 600,
      });

      expect(
        runtime.cognito
          .buildAuthorizeUrl,
      ).toHaveBeenCalledWith(
        state,
        transaction?.nonce,
        codeVerifier,
      );

      const location =
        responseLocation(
          response,
        );

      expect(
        location.origin,
      ).toBe(
        "https://auth.example.com",
      );

      expect(
        location.pathname,
      ).toBe(
        "/oauth2/authorize",
      );

      expect(
        location.searchParams.get(
          "state",
        ),
      ).toBe(state);

      expect(
        location.searchParams.get(
          "nonce",
        ),
      ).toBe(
        transaction?.nonce,
      );

      expect(
        location.searchParams.get(
          "code_verifier",
        ),
      ).toBe(
        codeVerifier,
      );

      const cookies =
        response.cookies ?? [];

      expect(cookies).toHaveLength(1);

      const cookie =
        cookies[0];

      if (!cookie) {
        throw new Error(
          "Expected an OAuth binding cookie.",
        );
      }

      const cookiePrefix =
        "__Host-sntimnt_oauth=";

      expect(
        cookie.startsWith(
          cookiePrefix,
        ),
      ).toBe(true);

      expect(
        cookie,
      ).toContain("Path=/");

      expect(
        cookie,
      ).toContain(
        "Max-Age=600",
      );

      expect(
        cookie,
      ).toContain(
        "SameSite=Lax",
      );

      expect(
        cookie,
      ).toContain("Secure");

      expect(
        cookie,
      ).toContain("HttpOnly");

      const cookiePair =
        cookie.split(";")[0];

      if (
        !cookiePair ||
        !cookiePair.startsWith(
          cookiePrefix,
        )
      ) {
        throw new Error(
          "Expected a valid OAuth cookie pair.",
        );
      }

      const browserBinding =
        cookiePair.slice(
          cookiePrefix.length,
        );

      expect(
        browserBinding.length,
      ).toBeGreaterThan(20);

      expect(
        transaction?.bindingHash,
      ).toBe(
        sha256(
          browserBinding,
        ),
      );

      expect(
        runtime.store.putSession,
      ).not.toHaveBeenCalled();
    });

    it("falls back to the dashboard for an unsafe login return target", async () => {
      const response =
        await invokeHandler(
          loginEvent(
            "https://attacker.example/phishing",
          ),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(303);

      const transaction =
        runtime.store
          .putOAuthTransaction
          .mock.calls[0]?.[1] as
          | Omit<
              OAuthTransactionRecord,
              "pk"
            >
          | undefined;

      expect(
        transaction?.returnTo,
      ).toBe("/dashboard");

      expect(
        response.cookies ?? [],
      ).toHaveLength(1);

      expect(
        runtime.cognito
          .buildAuthorizeUrl,
      ).toHaveBeenCalledTimes(1);
    });

    it("rate limits login before creating OAuth state", async () => {
      runtime.store
        .incrementRateLimit
        .mockResolvedValueOnce(21);

      const response =
        await invokeHandler(
          loginEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(429);

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        message:
          "Sign-in is temporarily limited. Please wait and try again.",
      });

      const retryAfter =
        Object.entries(
          response.headers ?? {},
        ).find(
          ([name]) =>
            name.toLowerCase() ===
            "retry-after",
        )?.[1];

      expect(
        String(retryAfter),
      ).toBe("300");

      expect(
        response.cookies ?? [],
      ).toEqual([]);

      expect(
        runtime.cipher.encrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store
          .putOAuthTransaction,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito
          .buildAuthorizeUrl,
      ).not.toHaveBeenCalled();
    });

    it("fails closed when login rate-limit state is unavailable", async () => {
      runtime.store
        .incrementRateLimit
        .mockRejectedValueOnce(
          new Error(
            "DynamoDB unavailable",
          ),
        );

      const response =
        await invokeHandler(
          loginEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(500);

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        message:
          "The authentication service is temporarily unavailable.",
      });

      expect(
        response.body,
      ).not.toContain(
        "DynamoDB unavailable",
      );

      expect(
        response.cookies ?? [],
      ).toEqual([]);

      expect(
        runtime.cipher.encrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store
          .putOAuthTransaction,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito
          .buildAuthorizeUrl,
      ).not.toHaveBeenCalled();

      expect(
        console.error,
      ).toHaveBeenCalledWith(
        "auth_request_failed",
        {
          requestId:
            "request-id",
          routeKey:
            "GET /api/auth/login",
          errorName:
            "Error",
        },
      );
    });

    it("does not issue an OAuth cookie when login transaction persistence fails", async () => {
      runtime.store
        .putOAuthTransaction
        .mockRejectedValueOnce(
          new Error(
            "DynamoDB unavailable",
          ),
        );

      const response =
        await invokeHandler(
          loginEvent(
            "/portfolio",
          ),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(500);

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        message:
          "The authentication service is temporarily unavailable.",
      });

      expect(
        response.body,
      ).not.toContain(
        "DynamoDB unavailable",
      );

      expect(
        response.cookies ?? [],
      ).toEqual([]);

      expect(
        runtime.cipher.encrypt,
      ).toHaveBeenCalledTimes(1);

      expect(
        runtime.store
          .putOAuthTransaction,
      ).toHaveBeenCalledTimes(1);

      expect(
        runtime.cognito
          .buildAuthorizeUrl,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.putSession,
      ).not.toHaveBeenCalled();
    });

    it("rejects malformed identity-provider callbacks before consuming OAuth state", async () => {
      const response =
        await invokeHandler(
          callbackEvent({
            code: null,
            error:
              "access_denied",
          }),
          context,
        );

      expectAuthenticationFailedRedirect(
        response,
      );

      expect(
        runtime.store
          .consumeOAuthTransaction,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito
          .exchangeAuthorizationCode,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.putSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("rejects a replay after the OAuth transaction was already consumed", async () => {
      runtime.store
        .consumeOAuthTransaction
        .mockResolvedValueOnce(null);

      const response =
        await invokeHandler(
          callbackEvent(),
          context,
        );

      expectAuthenticationFailedRedirect(
        response,
      );

      expect(
        runtime.store
          .consumeOAuthTransaction,
      ).toHaveBeenCalledTimes(1);

      expect(
        runtime.store
          .consumeOAuthTransaction,
      ).toHaveBeenCalledWith(
        OAUTH_STATE,
      );

      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito
          .exchangeAuthorizationCode,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.putSession,
      ).not.toHaveBeenCalled();
    });

    it("rejects an expired OAuth transaction before token exchange", async () => {
      runtime.store
        .consumeOAuthTransaction
        .mockResolvedValueOnce(
          oauthTransaction({
            expiresAt: NOW,
            ttl: NOW,
          }),
        );

      const response =
        await invokeHandler(
          callbackEvent(),
          context,
        );

      expectAuthenticationFailedRedirect(
        response,
      );

      expect(
        runtime.store
          .consumeOAuthTransaction,
      ).toHaveBeenCalledWith(
        OAUTH_STATE,
      );

      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito
          .exchangeAuthorizationCode,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.putSession,
      ).not.toHaveBeenCalled();
    });

    it("rejects a callback with a mismatched browser binding", async () => {
      const response =
        await invokeHandler(
          callbackEvent({
            binding:
              "different-browser-binding",
          }),
          context,
        );

      expectAuthenticationFailedRedirect(
        response,
      );

      expect(
        runtime.store
          .consumeOAuthTransaction,
      ).toHaveBeenCalledWith(
        OAUTH_STATE,
      );

      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito
          .exchangeAuthorizationCode,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.putSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("clears OAuth state when authorization-code exchange fails", async () => {
      runtime.cognito
        .exchangeAuthorizationCode
        .mockRejectedValueOnce(
          new Error(
            "Cognito token endpoint unavailable",
          ),
        );

      const response =
        await invokeHandler(
          callbackEvent(),
          context,
        );

      expectAuthenticationFailedRedirect(
        response,
      );

      expect(
        runtime.cipher.decrypt,
      ).toHaveBeenCalledWith(
        "pkce-verifier-ciphertext",
        "oauth-pkce-verifier",
        OAUTH_STATE,
      );

      expect(
        runtime.cognito
          .exchangeAuthorizationCode,
      ).toHaveBeenCalledWith(
        "authorization-code",
        "decrypted-secret",
      );

      expect(
        runtime.cognito
          .verifyIdentity,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.putSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();

      expect(
        response.body,
      ).not.toContain(
        "Cognito token endpoint unavailable",
      );
    });

    it("revokes the issued refresh token when callback session persistence fails", async () => {
      runtime.store.putSession
        .mockRejectedValueOnce(
          new Error(
            "DynamoDB unavailable",
          ),
        );

      const response =
        await invokeHandler(
          callbackEvent(),
          context,
        );

      expectAuthenticationFailedRedirect(
        response,
      );

      expect(
        runtime.cognito
          .exchangeAuthorizationCode,
      ).toHaveBeenCalledWith(
        "authorization-code",
        "decrypted-secret",
      );

      expect(
        runtime.cognito
          .verifyIdentity,
      ).toHaveBeenCalledWith(
        "id-token",
        "oauth-nonce",
      );

      expect(
        runtime.store.putSession,
      ).toHaveBeenCalledTimes(1);

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledTimes(1);

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledWith(
        "refresh-token",
      );

      expect(
        response.body,
      ).not.toContain(
        "DynamoDB unavailable",
      );

      expect(
        response.cookies?.some(
          (cookie) =>
            cookie.startsWith(
              "__Host-sntimnt_session=",
            ),
        ),
      ).toBe(false);

      expect(
        response.cookies?.some(
          (cookie) =>
            cookie.startsWith(
              "__Host-sntimnt_csrf=",
            ),
        ),
      ).toBe(false);
    });

    it("creates a configured administrator session from the callback Cognito MFA state", async () => {
      const response =
        await invokeHandler(
          callbackEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(303);

      expect(
        responseLocation(
          response,
        ).toString(),
      ).toBe(
        APP_ORIGIN +
        "/dashboard",
      );

      expect(
        runtime.cognitoMfa
          .getUserMfaStatus,
      ).toHaveBeenCalledWith(
        "access-token",
      );

      const call =
        runtime.store
          .putSession
          .mock.calls[0];

      expect(call).toBeDefined();

      const [
        sessionId,
        record,
      ] = call as [
        string,
        Omit<
          SessionRecord,
          "pk"
        >,
      ];

      expect(sessionId).not.toBe(
        "",
      );

      expect(
        record
          .adminMfaConfiguration,
      ).toBe("configured");

      expect(
        response.cookies?.some(
          (cookie) =>
            cookie.startsWith(
              "__Host-sntimnt_session=",
            ) &&
            cookie.includes(
              "HttpOnly",
            ),
        ),
      ).toBe(true);
    });

    it("creates an enrollment-required administrator session when Cognito TOTP is not preferred", async () => {
      runtime.cognitoMfa
        .getUserMfaStatus
        .mockResolvedValueOnce({
          softwareTokenMfaEnabled:
            true,
          softwareTokenMfaPreferred:
            false,
        });

      await invokeHandler(
        callbackEvent(),
        context,
      );

      const call =
        runtime.store
          .putSession
          .mock.calls[0];

      expect(call).toBeDefined();

      const record =
        call?.[1] as
          | Omit<
              SessionRecord,
              "pk"
            >
          | undefined;

      expect(
        record
          ?.adminMfaConfiguration,
      ).toBe(
        "enrollment-required",
      );
    });

    it("does not query Cognito MFA for a non-administrator callback", async () => {
      runtime.cognito
        .verifyIdentity
        .mockResolvedValueOnce(
          identity(
            investorUser,
          ),
        );

      await invokeHandler(
        callbackEvent(),
        context,
      );

      expect(
        runtime.cognitoMfa
          .getUserMfaStatus,
      ).not.toHaveBeenCalled();

      const call =
        runtime.store
          .putSession
          .mock.calls[0];

      const record =
        call?.[1] as
          | Omit<
              SessionRecord,
              "pk"
            >
          | undefined;

      expect(
        record
          ?.adminMfaConfiguration,
      ).toBe("not-required");
    });

    it("revokes the callback refresh token when administrator MFA lookup fails", async () => {
      runtime.cognitoMfa
        .getUserMfaStatus
        .mockRejectedValueOnce(
          new Error(
            "Cognito unavailable",
          ),
        );

      const response =
        await invokeHandler(
          callbackEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(303);

      expect(
        responseLocation(
          response,
        ).pathname,
      ).toBe("/login");

      expect(
        responseLocation(
          response,
        ).searchParams.get(
          "reason",
        ),
      ).toBe(
        "authentication-failed",
      );

      expect(
        runtime.store.putSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledWith(
        "refresh-token",
      );
    });


    it("rejects refresh without a session cookie", async () => {
      const response =
        await invokeHandler(
          refreshEvent({
            authenticated: false,
          }),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        message:
          "Authentication is required.",
      });

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.getSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.refresh,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.rotateSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.deleteSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("rejects refresh without valid CSRF proof", async () => {
      const response =
        await invokeHandler(
          refreshEvent({
            csrf: false,
          }),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(403);

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        message:
          "The request could not be verified.",
      });

      expect(
        response.cookies ?? [],
      ).toEqual([]);

      expect(
        runtime.store.getSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.refresh,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.rotateSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.deleteSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("destroys the session when refresh-token decryption fails", async () => {
      const current =
        session();

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockRejectedValueOnce(
          new Error(
            "KMS unavailable",
          ),
        )
        .mockRejectedValueOnce(
          new Error(
            "KMS unavailable",
          ),
        );

      const response =
        await invokeHandler(
          refreshEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        message:
          "Authentication is required.",
      });

      expectClearedCookies(
        response,
      );

      expect(
        response.body,
      ).not.toContain(
        "KMS unavailable",
      );

      expect(
        runtime.cipher.decrypt,
      ).toHaveBeenCalledTimes(2);

      expect(
        runtime.cipher.decrypt,
      ).toHaveBeenNthCalledWith(
        1,
        "old-refresh-ciphertext",
        "cognito-refresh-token",
        SESSION_ID,
      );

      expect(
        runtime.cipher.decrypt,
      ).toHaveBeenNthCalledWith(
        2,
        "old-refresh-ciphertext",
        "cognito-refresh-token",
        SESSION_ID,
      );

      expect(
        runtime.cognito.refresh,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.rotateSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();

      expect(
        console.error,
      ).toHaveBeenCalledWith(
        "auth_token_decrypt_failed",
        {
          requestId:
            "request-id",
          errorName:
            "Error",
        },
      );
    });

    it("destroys and revokes the old session when Cognito refresh fails", async () => {
      const current =
        session();

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockResolvedValueOnce(
          "old-refresh-token",
        )
        .mockResolvedValueOnce(
          "old-refresh-token",
        );

      runtime.cognito.refresh
        .mockRejectedValueOnce(
          new Error(
            "Cognito refresh unavailable",
          ),
        );

      const response =
        await invokeHandler(
          refreshEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expectClearedCookies(
        response,
      );

      expect(
        response.body,
      ).not.toContain(
        "Cognito refresh unavailable",
      );

      expect(
        runtime.cognito.refresh,
      ).toHaveBeenCalledWith(
        "old-refresh-token",
      );

      expect(
        runtime.cognito
          .verifyIdentity,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.rotateSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledTimes(1);

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledWith(
        "old-refresh-token",
      );
    });

    it("revokes both refresh tokens when refreshed identity verification fails", async () => {
      const current =
        session();

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockResolvedValueOnce(
          "old-refresh-token",
        )
        .mockResolvedValueOnce(
          "old-refresh-token",
        );

      runtime.cognito
        .verifyIdentity
        .mockRejectedValueOnce(
          new Error(
            "Invalid refreshed identity",
          ),
        );

      const response =
        await invokeHandler(
          refreshEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expectClearedCookies(
        response,
      );

      expect(
        response.body,
      ).not.toContain(
        "Invalid refreshed identity",
      );

      expect(
        runtime.cognito.refresh,
      ).toHaveBeenCalledWith(
        "old-refresh-token",
      );

      expect(
        runtime.cognito
          .verifyIdentity,
      ).toHaveBeenCalledWith(
        "next-id-token",
        undefined,
        "admin-1",
      );

      expect(
        runtime.cognitoMfa
          .getUserMfaStatus,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.rotateSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledTimes(2);

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenNthCalledWith(
        1,
        "next-refresh-token",
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenNthCalledWith(
        2,
        "old-refresh-token",
      );
    });

    it("reuses the existing refresh token when Cognito does not rotate it", async () => {
      runtime.cipher.decrypt
        .mockResolvedValueOnce(
          "old-refresh-token",
        );

      runtime.cognito.refresh
        .mockResolvedValueOnce({
          idToken:
            "next-id-token",
          accessToken:
            "next-access-token",
          expiresIn: 3_600,
        });

      const response =
        await invokeHandler(
          refreshEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(200);

      expect(
        runtime.cognito.refresh,
      ).toHaveBeenCalledWith(
        "old-refresh-token",
      );

      expect(
        runtime.store.rotateSession,
      ).toHaveBeenCalledTimes(1);

      const rotateCall =
        runtime.store
          .rotateSession
          .mock.calls[0];

      expect(
        rotateCall,
      ).toBeDefined();

      const [
        oldSessionId,
        nextSessionId,
        record,
      ] = rotateCall as [
        string,
        string,
        Omit<
          SessionRecord,
          "pk"
        >,
      ];

      expect(
        oldSessionId,
      ).toBe(SESSION_ID);

      expect(
        nextSessionId,
      ).not.toBe("");

      expect(
        nextSessionId,
      ).not.toBe(
        SESSION_ID,
      );

      expect(
        runtime.cipher.encrypt,
      ).toHaveBeenCalledWith(
        "old-refresh-token",
        "cognito-refresh-token",
        nextSessionId,
      );

      expect(
        runtime.cipher.encrypt,
      ).toHaveBeenCalledWith(
        "next-access-token",
        "cognito-access-token",
        nextSessionId,
      );

      expect(
        record
          .refreshTokenCiphertext,
      ).toBe(
        "cognito-refresh-token-ciphertext",
      );

      expect(
        record
          .accessTokenCiphertext,
      ).toBe(
        "cognito-access-token-ciphertext",
      );

      expect(
        response.cookies?.some(
          (cookie) =>
            cookie.startsWith(
              "__Host-sntimnt_session=" +
                nextSessionId,
            ),
        ),
      ).toBe(true);

      expect(
        response.cookies?.some(
          (cookie) =>
            cookie.startsWith(
              "__Host-sntimnt_csrf=",
            ),
        ),
      ).toBe(true);

      expect(
        runtime.store.deleteSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("revokes both refresh tokens when session rotation fails", async () => {
      const current =
        session();

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockResolvedValueOnce(
          "old-refresh-token",
        )
        .mockResolvedValueOnce(
          "old-refresh-token",
        );

      runtime.store.rotateSession
        .mockRejectedValueOnce(
          new Error(
            "Session rotation conflict",
          ),
        );

      const response =
        await invokeHandler(
          refreshEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expectClearedCookies(
        response,
      );

      expect(
        response.body,
      ).not.toContain(
        "Session rotation conflict",
      );

      expect(
        runtime.store.rotateSession,
      ).toHaveBeenCalledTimes(1);

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledTimes(2);

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenNthCalledWith(
        1,
        "next-refresh-token",
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenNthCalledWith(
        2,
        "old-refresh-token",
      );
    });

    it("replaces stale configured administrator state during refresh", async () => {
      runtime.store.getSession
        .mockResolvedValueOnce(
          session({
            adminMfaConfiguration:
              "configured",
          }),
        );

      runtime.cipher.decrypt
        .mockResolvedValueOnce(
          "old-refresh-token",
        );

      runtime.cognitoMfa
        .getUserMfaStatus
        .mockResolvedValueOnce({
          softwareTokenMfaEnabled:
            false,
          softwareTokenMfaPreferred:
            false,
        });

      const response =
        await invokeHandler(
          refreshEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(200);

      expect(
        runtime.cognitoMfa
          .getUserMfaStatus,
      ).toHaveBeenCalledWith(
        "next-access-token",
      );

      const call =
        runtime.store
          .rotateSession
          .mock.calls[0];

      expect(call).toBeDefined();

      const [
        oldSessionId,
        nextSessionId,
        record,
      ] = call as [
        string,
        string,
        Omit<
          SessionRecord,
          "pk"
        >,
      ];

      expect(oldSessionId).toBe(
        SESSION_ID,
      );

      expect(
        nextSessionId,
      ).not.toBe("");

      expect(
        record
          .adminMfaConfiguration,
      ).toBe(
        "enrollment-required",
      );

      expect(
        responseBody(
          response,
        ),
      ).not.toHaveProperty(
        "adminMfaConfiguration",
      );
    });

    it("clears administrator MFA state when refreshed roles are no longer administrative", async () => {
      runtime.store.getSession
        .mockResolvedValueOnce(
          session({
            adminMfaConfiguration:
              "configured",
          }),
        );

      runtime.cipher.decrypt
        .mockResolvedValueOnce(
          "old-refresh-token",
        );

      runtime.cognito
        .verifyIdentity
        .mockResolvedValueOnce(
          identity(
            formerAdminInvestor,
          ),
        );

      await invokeHandler(
        refreshEvent(),
        context,
      );

      expect(
        runtime.cognitoMfa
          .getUserMfaStatus,
      ).not.toHaveBeenCalled();

      const call =
        runtime.store
          .rotateSession
          .mock.calls[0];

      const record =
        call?.[2] as
          | Omit<
              SessionRecord,
              "pk"
            >
          | undefined;

      expect(
        record
          ?.adminMfaConfiguration,
      ).toBe("not-required");

      expect(
        record?.user.roles,
      ).toEqual(["investor"]);
    });

    it("destroys the old session and revokes both refresh tokens when refresh MFA lookup fails", async () => {
      const current =
        session({
          adminMfaConfiguration:
            "configured",
        });

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockResolvedValueOnce(
          "old-refresh-token",
        )
        .mockResolvedValueOnce(
          "old-refresh-token",
        );

      runtime.cognitoMfa
        .getUserMfaStatus
        .mockRejectedValueOnce(
          new Error(
            "Cognito unavailable",
          ),
        );

      const response =
        await invokeHandler(
          refreshEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store
          .rotateSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store
          .deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledTimes(
        2,
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenNthCalledWith(
        1,
        "next-refresh-token",
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenNthCalledWith(
        2,
        "old-refresh-token",
      );
    });

    it("rejects session reads without a session cookie", async () => {
      const response =
        await invokeHandler(
          sessionEvent(false),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        message:
          "Authentication is required.",
      });

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.getSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.touchSession,
      ).not.toHaveBeenCalled();
    });

    it("rejects a missing server-side session", async () => {
      runtime.store.getSession
        .mockResolvedValueOnce(
          null,
        );

      const response =
        await invokeHandler(
          sessionEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.getSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.store.touchSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.deleteSession,
      ).not.toHaveBeenCalled();
    });

    it("invalidates and revokes an expired session", async () => {
      const expired =
        session({
          idleExpiresAt: NOW,
        });

      runtime.store.getSession
        .mockResolvedValueOnce(
          expired,
        );

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          expired,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockResolvedValueOnce(
          "expired-refresh-token",
        );

      const response =
        await invokeHandler(
          sessionEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cipher.decrypt,
      ).toHaveBeenCalledWith(
        "old-refresh-ciphertext",
        "cognito-refresh-token",
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledWith(
        "expired-refresh-token",
      );

      expect(
        runtime.store.touchSession,
      ).not.toHaveBeenCalled();
    });

    it("clears cookies when session touch loses a race", async () => {
      const current =
        session();

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.store.touchSession
        .mockResolvedValueOnce(
          null,
        );

      const response =
        await invokeHandler(
          sessionEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.touchSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
        current,
        NOW,
        NOW + 1_800,
      );

      expect(
        runtime.store.deleteSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("returns only public session data after a successful touch", async () => {
      const current =
        session();

      const touched =
        session({
          lastSeenAt: NOW,
          idleExpiresAt:
            NOW + 1_800,
        });

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.store.touchSession
        .mockResolvedValueOnce(
          touched,
        );

      const response =
        await invokeHandler(
          sessionEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(200);

      expect(
        runtime.store.touchSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
        current,
        NOW,
        NOW + 1_800,
      );

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        user: adminUser,
        expiresAt:
          new Date(
            (NOW + 1_800) *
              1_000,
          ).toISOString(),
        refreshAfter:
          new Date(
            (NOW + 300) *
              1_000,
          ).toISOString(),
      });

      expect(
        response.body,
      ).not.toContain(
        "adminMfaConfiguration",
      );

      expect(
        response.body,
      ).not.toContain(
        "refreshTokenCiphertext",
      );

      expect(
        response.body,
      ).not.toContain(
        "accessTokenCiphertext",
      );

      expect(
        response.body,
      ).not.toContain(
        "csrfHash",
      );

      expect(
        response.cookies ?? [],
      ).toEqual([]);
    });

    it("completes an unauthenticated logout idempotently", async () => {
      const response =
        await invokeHandler(
          logoutEvent({
            authenticated:
              false,
          }),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(204);

      expect(
        response.body,
      ).toBe("");

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.getSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.store.deleteSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("rejects logout without valid CSRF proof", async () => {
      const current =
        session();

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      const response =
        await invokeHandler(
          logoutEvent({
            csrf: false,
          }),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(403);

      expect(
        responseBody(
          response,
        ),
      ).toEqual({
        message:
          "The request could not be verified.",
      });

      expect(
        response.cookies ?? [],
      ).toEqual([]);

      expect(
        runtime.store.deleteSession,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("deletes the session and revokes its refresh token during logout", async () => {
      const current =
        session();

      runtime.store.getSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockResolvedValueOnce(
          "logout-refresh-token",
        );

      const response =
        await invokeHandler(
          logoutEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(204);

      expect(
        response.body,
      ).toBe("");

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cipher.decrypt,
      ).toHaveBeenCalledWith(
        "old-refresh-ciphertext",
        "cognito-refresh-token",
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledWith(
        "logout-refresh-token",
      );
    });

    it("completes logout when session deletion loses a race", async () => {
      runtime.store.deleteSession
        .mockResolvedValueOnce(
          null,
        );

      const response =
        await invokeHandler(
          logoutEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(204);

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("completes local logout when refresh-token decryption fails", async () => {
      const current =
        session();

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockRejectedValueOnce(
          new Error(
            "KMS unavailable",
          ),
        );

      const response =
        await invokeHandler(
          logoutEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(204);

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).not.toHaveBeenCalled();
    });

    it("completes local logout when Cognito token revocation fails", async () => {
      const current =
        session();

      runtime.store.deleteSession
        .mockResolvedValueOnce(
          current,
        );

      runtime.cipher.decrypt
        .mockReset()
        .mockResolvedValueOnce(
          "logout-refresh-token",
        );

      runtime.cognito.revoke
        .mockRejectedValueOnce(
          new Error(
            "Cognito unavailable",
          ),
        );

      const response =
        await invokeHandler(
          logoutEvent(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(204);

      expectClearedCookies(
        response,
      );

      expect(
        runtime.store.deleteSession,
      ).toHaveBeenCalledWith(
        SESSION_ID,
      );

      expect(
        runtime.cognito.revoke,
      ).toHaveBeenCalledWith(
        "logout-refresh-token",
      );
    });
  },
);
