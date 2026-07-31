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
import type { SessionRecord } from "../src/types.js";

const NOW = 2_000_000_000;
const APP_ORIGIN = "https://app.example.com";
const SESSION_ID = "session-id";
const CSRF_TOKEN = "csrf-token";

const runtime = vi.hoisted(() => ({
  config: {
    appOrigin: "https://app.example.com",
    cookieSecure: true,
    recentAuthenticationMaxAgeSeconds: 300,
  },
  store: {
    getSession: vi.fn(),
    deleteSession: vi.fn(),
  },
  cipher: {
    decrypt: vi.fn(),
  },
  cognito: {
    revoke: vi.fn(),
  },
  cognitoMfa: {
    startTotpEnrollment: vi.fn(),
    completeTotpEnrollment: vi.fn(),
  },
}));

vi.mock("../src/runtime.js", () => ({
  createAuthRuntime: () => runtime,
}));

let invokeHandler: (
  event: APIGatewayProxyEventV2,
  context: Context,
) => Promise<APIGatewayProxyStructuredResultV2>;

const context = {
  awsRequestId: "request-id",
} as Context;

function session(
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  return {
    pk: "AUTH#SESSION#test",
    kind: "session",
    user: {
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Administrator",
      roles: ["admin"],
    },
    refreshTokenCiphertext:
      "refresh-token-ciphertext",
    accessTokenCiphertext:
      "access-token-ciphertext",
    csrfHash: sha256(CSRF_TOKEN),
    subject: "admin-1",
    authenticatedAt: NOW - 100,
    createdAt: NOW - 100,
    lastSeenAt: NOW - 100,
    absoluteExpiresAt: NOW + 3_600,
    idleExpiresAt: NOW + 1_800,
    tokenExpiresAt: NOW + 600,
    ttl: NOW + 3_600,
    ...overrides,
  };
}

function event(
  path: string,
  input: {
    authenticated?: boolean;
    csrf?: boolean;
    body?: string;
    isBase64Encoded?: boolean;
  } = {},
): APIGatewayProxyEventV2 {
  const headers: Record<string, string> = {
    origin: APP_ORIGIN,
  };

  const cookies: string[] = [];

  if (input.authenticated !== false) {
    cookies.push(
      "__Host-sntimnt_session=" + SESSION_ID,
    );
  }

  if (input.csrf !== false) {
    headers["x-csrf-token"] = CSRF_TOKEN;
    cookies.push(
      "__Host-sntimnt_csrf=" + CSRF_TOKEN,
    );
  }

  return {
    version: "2.0",
    routeKey: "POST " + path,
    rawPath: path,
    rawQueryString: "",
    headers,
    cookies,
    requestContext: {
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "app.example.com",
      domainPrefix: "app",
      http: {
        method: "POST",
        path,
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "request-id",
      routeKey: "POST " + path,
      stage: "$default",
      time: "01/Jan/2033:00:00:00 +0000",
      timeEpoch: NOW * 1_000,
    },
    ...(input.body === undefined
      ? {}
      : { body: input.body }),
    isBase64Encoded:
      input.isBase64Encoded ?? false,
  };
}

function responseBody(
  response: APIGatewayProxyStructuredResultV2,
): Record<string, unknown> {
  return JSON.parse(
    response.body ?? "{}",
  ) as Record<string, unknown>;
}

function expectClearedCookies(
  response: APIGatewayProxyStructuredResultV2,
): void {
  const cookies = response.cookies ?? [];

  expect(cookies).toHaveLength(3);
  expect(
    cookies.every((cookie) =>
      cookie.includes("Max-Age=0"),
    ),
  ).toBe(true);
}

function namedError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

beforeAll(async () => {
  const handlerModule =
    await import("../src/handler.js");

  invokeHandler = handlerModule.handler;
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW * 1_000));

  runtime.store.getSession
    .mockReset()
    .mockResolvedValue(session());

  runtime.store.deleteSession
    .mockReset()
    .mockResolvedValue(null);

  runtime.cipher.decrypt
    .mockReset()
    .mockResolvedValue("access-token");

  runtime.cognito.revoke
    .mockReset()
    .mockResolvedValue(undefined);

  runtime.cognitoMfa.startTotpEnrollment
    .mockReset()
    .mockResolvedValue({
      secretCode: "ABCDEFGHIJKLMNOP",
    });

  runtime.cognitoMfa.completeTotpEnrollment
    .mockReset()
    .mockResolvedValue(undefined);

  vi.spyOn(console, "error").mockImplementation(
    () => undefined,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TOTP enrollment HTTP boundary", () => {
  const startPath =
    "/api/auth/mfa/totp/start";
  const completePath =
    "/api/auth/mfa/totp/complete";

  it("rejects an unauthenticated enrollment-start request", async () => {
    const response = await invokeHandler(
      event(startPath, {
        authenticated: false,
      }),
      context,
    );

    expect(response.statusCode).toBe(401);
    expect(responseBody(response)).toEqual({
      message: "Authentication is required.",
    });
    expectClearedCookies(response);
    expect(
      runtime.store.getSession,
    ).not.toHaveBeenCalled();
    expect(
      runtime.cipher.decrypt,
    ).not.toHaveBeenCalled();
  });

  it("rejects an enrollment request without valid CSRF proof", async () => {
    const response = await invokeHandler(
      event(startPath, {
        csrf: false,
      }),
      context,
    );

    expect(response.statusCode).toBe(403);
    expect(responseBody(response)).toEqual({
      message:
        "The request could not be verified.",
    });
    expect(
      runtime.cipher.decrypt,
    ).not.toHaveBeenCalled();
    expect(
      runtime.cognitoMfa.startTotpEnrollment,
    ).not.toHaveBeenCalled();
  });

  it.each([
    "investor",
    "operations",
  ] as const)(
    "rejects the %s role at the handler boundary",
    async (role) => {
      runtime.store.getSession.mockResolvedValue(
        session({
          user: {
            id: "user-1",
            email: "user@example.com",
            displayName: "User",
            roles: [role],
          },
        }),
      );

      const response = await invokeHandler(
        event(startPath),
        context,
      );

      expect(response.statusCode).toBe(403);
      expect(responseBody(response)).toEqual({
        message:
          "The requested operation is not permitted.",
      });
      expect(
        runtime.cipher.decrypt,
      ).not.toHaveBeenCalled();
    },
  );

  it("requires recent authentication at the handler boundary", async () => {
    runtime.store.getSession.mockResolvedValue(
      session({
        authenticatedAt: NOW - 301,
        createdAt: NOW - 301,
      }),
    );

    const response = await invokeHandler(
      event(startPath),
      context,
    );

    expect(response.statusCode).toBe(403);
    expect(responseBody(response)).toEqual({
      message:
        "Recent authentication is required.",
    });
    expect(
      runtime.cipher.decrypt,
    ).not.toHaveBeenCalled();
  });

  it("requires refresh when the Cognito access token is expiring", async () => {
    runtime.store.getSession.mockResolvedValue(
      session({
        tokenExpiresAt: NOW + 30,
      }),
    );

    const response = await invokeHandler(
      event(startPath),
      context,
    );

    expect(response.statusCode).toBe(409);
    expect(responseBody(response)).toEqual({
      message:
        "Refresh the session before continuing MFA enrollment.",
    });
    expect(
      runtime.cipher.decrypt,
    ).not.toHaveBeenCalled();
  });

  it("returns only the one-time TOTP enrollment secret", async () => {
    const response = await invokeHandler(
      event(startPath),
      context,
    );

    expect(response.statusCode).toBe(200);
    expect(responseBody(response)).toEqual({
      secretCode: "ABCDEFGHIJKLMNOP",
    });
    expect(response.headers).toMatchObject({
      "Cache-Control":
        "no-store, max-age=0",
      Pragma: "no-cache",
    });

    expect(runtime.cipher.decrypt).toHaveBeenCalledWith(
      "access-token-ciphertext",
      "cognito-access-token",
      SESSION_ID,
    );

    expect(
      runtime.cognitoMfa.startTotpEnrollment,
    ).toHaveBeenCalledWith("access-token");

    expect(response.body).not.toContain(
      "access-token-ciphertext",
    );
    expect(response.body).not.toContain(
      "\"accessToken\"",
    );
  });

  it("invalidates the session when access-token decryption fails", async () => {
    runtime.cipher.decrypt
      .mockReset()
      .mockRejectedValueOnce(
        new Error("KMS unavailable"),
      );

    const response = await invokeHandler(
      event(startPath),
      context,
    );

    expect(response.statusCode).toBe(401);
    expectClearedCookies(response);
    expect(
      runtime.store.deleteSession,
    ).toHaveBeenCalledWith(SESSION_ID);
    expect(
      runtime.cognitoMfa.startTotpEnrollment,
    ).not.toHaveBeenCalled();
  });

  it("invalidates and revokes a session rejected by Cognito", async () => {
    runtime.cipher.decrypt
      .mockReset()
      .mockResolvedValueOnce("access-token")
      .mockResolvedValueOnce("refresh-token");

    runtime.store.deleteSession.mockResolvedValueOnce(
      session(),
    );

    runtime.cognitoMfa.startTotpEnrollment
      .mockRejectedValueOnce(
        namedError("NotAuthorizedException"),
      );

    const response = await invokeHandler(
      event(startPath),
      context,
    );

    expect(response.statusCode).toBe(401);
    expectClearedCookies(response);
    expect(
      runtime.store.deleteSession,
    ).toHaveBeenCalledWith(SESSION_ID);
    expect(runtime.cognito.revoke).toHaveBeenCalledWith(
      "refresh-token",
    );
  });

  it("returns a safe service error without logging MFA values", async () => {
    runtime.cognitoMfa.startTotpEnrollment
      .mockRejectedValueOnce(
        new Error("temporary failure"),
      );

    const response = await invokeHandler(
      event(startPath),
      context,
    );

    expect(response.statusCode).toBe(503);
    expect(responseBody(response)).toEqual({
      message:
        "MFA enrollment is temporarily unavailable.",
    });

    expect(console.error).toHaveBeenCalledWith(
      "auth_totp_enrollment_start_failed",
      {
        requestId: "request-id",
        errorName: "Error",
      },
    );

    const renderedLogs = JSON.stringify(
      vi.mocked(console.error).mock.calls,
    );

    expect(renderedLogs).not.toContain(
      "access-token",
    );
    expect(renderedLogs).not.toContain(
      "ABCDEFGHIJKLMNOP",
    );
    expect(renderedLogs).not.toContain(
      "123456",
    );
  });

  it("rejects a malformed completion body before token decryption", async () => {
    const response = await invokeHandler(
      event(completePath, {
        body: JSON.stringify({
          userCode: "123456",
          accessToken:
            "must-not-be-accepted",
        }),
      }),
      context,
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({
      message:
        "A valid six-digit verification code is required.",
    });
    expect(
      runtime.cipher.decrypt,
    ).not.toHaveBeenCalled();
    expect(
      runtime.cognitoMfa.completeTotpEnrollment,
    ).not.toHaveBeenCalled();
  });

  it("completes TOTP enrollment with an empty success response", async () => {
    const response = await invokeHandler(
      event(completePath, {
        body: JSON.stringify({
          userCode: "123456",
        }),
      }),
      context,
    );

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(response.cookies ?? []).toEqual([]);

    expect(
      runtime.cognitoMfa.completeTotpEnrollment,
    ).toHaveBeenCalledWith(
      "access-token",
      "123456",
    );
  });

  it("keeps the session when Cognito rejects only the TOTP code", async () => {
    runtime.cognitoMfa.completeTotpEnrollment
      .mockRejectedValueOnce(
        namedError("CodeMismatchException"),
      );

    const response = await invokeHandler(
      event(completePath, {
        body: JSON.stringify({
          userCode: "123456",
        }),
      }),
      context,
    );

    expect(response.statusCode).toBe(400);
    expect(responseBody(response)).toEqual({
      message:
        "The verification code was not accepted.",
    });

    expect(
      runtime.store.deleteSession,
    ).not.toHaveBeenCalled();
    expect(runtime.cognito.revoke).not.toHaveBeenCalled();
  });

  it("invalidates completion when Cognito rejects the access token", async () => {
    runtime.cipher.decrypt
      .mockReset()
      .mockResolvedValueOnce("access-token")
      .mockResolvedValueOnce("refresh-token");

    runtime.store.deleteSession.mockResolvedValueOnce(
      session(),
    );

    runtime.cognitoMfa.completeTotpEnrollment
      .mockRejectedValueOnce(
        namedError("UserNotFoundException"),
      );

    const response = await invokeHandler(
      event(completePath, {
        body: JSON.stringify({
          userCode: "123456",
        }),
      }),
      context,
    );

    expect(response.statusCode).toBe(401);
    expectClearedCookies(response);
    expect(
      runtime.store.deleteSession,
    ).toHaveBeenCalledWith(SESSION_ID);
    expect(runtime.cognito.revoke).toHaveBeenCalledWith(
      "refresh-token",
    );
  });
});
