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
  },
  store: {
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

function oauthTransaction():
  OAuthTransactionRecord {
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

function callbackEvent():
  APIGatewayProxyEventV2 {
  return event(
    "GET",
    "/api/auth/callback",
    {
      cookies: [
        "__Host-sntimnt_oauth=" +
          OAUTH_BINDING,
      ],
      queryStringParameters: {
        state: OAUTH_STATE,
        code: "authorization-code",
      },
    },
  );
}

function refreshEvent():
  APIGatewayProxyEventV2 {
  return event(
    "POST",
    "/api/auth/refresh",
    {
      cookies: [
        "__Host-sntimnt_session=" +
          SESSION_ID,
        "__Host-sntimnt_csrf=" +
          CSRF_TOKEN,
      ],
      headers: {
        origin: APP_ORIGIN,
        "x-csrf-token":
          CSRF_TOKEN,
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
