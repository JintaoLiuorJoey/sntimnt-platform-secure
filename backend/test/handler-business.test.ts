import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type {
  InvestmentAccountSummary,
} from "../src/business-records.js";
import type {
  SessionRecord,
  UserRole,
} from "../src/types.js";

const runtime =
  vi.hoisted(() => ({
    config: {
      region: "us-east-1",
      tableName: "auth-table",
      kmsKeyId: "auth-key",
      userPoolId: "user-pool",
      clientId: "client-id",
      cognitoDomain:
        "https://auth.example.com",
      cognitoIssuer:
        "https://issuer.example.com",
      appOrigin:
        "https://app.example.com",
      callbackUrl:
        "https://app.example.com/api/auth/callback",
      absoluteTtlSeconds:
        28_800,
      idleTtlSeconds:
        1_800,
      recentAuthenticationMaxAgeSeconds:
        300,
      oauthTransactionTtlSeconds:
        600,
      loginRateLimitCount:
        20,
      loginRateLimitWindowSeconds:
        300,
      cookieSecure: true,
    },
    store: {
      getSession: vi.fn(),
      deleteSession: vi.fn(),
    },
    cipher: {},
    cognito: {},
    cognitoMfa: {},
  }));

const businessRuntime =
  vi.hoisted(() => ({
    store: {
      listInvestmentAccounts:
        vi.fn(),
    },
  }));

vi.mock(
  "../src/runtime.js",
  () => ({
    createAuthRuntime:
      () => runtime,
  }),
);

vi.mock(
  "../src/business-runtime.js",
  () => ({
    getBusinessStore:
      () =>
        businessRuntime.store,
  }),
);

let invokeHandler:
  (
    event:
      APIGatewayProxyEventV2,
    context:
      Context,
  ) =>
    Promise<
      APIGatewayProxyStructuredResultV2
    >;

const context = {
  awsRequestId:
    "lambda-request-id",
} as Context;

function session(
  roles:
    UserRole[] = ["investor"],
  overrides:
    Partial<SessionRecord> = {},
): SessionRecord {
  return {
    pk:
      "AUTH#SESSION#stored",
    kind: "session",
    user: {
      id:
        "mutable-user-id",
      email:
        "investor@example.com",
      displayName:
        "Verified Investor",
      roles,
    },
    adminMfaConfiguration:
      roles.includes("admin")
        ? "configured"
        : "not-required",
    refreshTokenCiphertext:
      "refresh-ciphertext",
    accessTokenCiphertext:
      "access-ciphertext",
    csrfHash:
      "csrf-hash",
    subject:
      "canonical-business-subject",
    authenticatedAt:
      2_000_000_000,
    createdAt:
      2_000_000_000,
    lastSeenAt:
      2_000_000_000,
    absoluteExpiresAt:
      4_000_000_000,
    idleExpiresAt:
      4_000_000_000,
    tokenExpiresAt:
      4_000_000_000,
    ttl:
      4_000_000_000,
    ...overrides,
  };
}

interface EventInput {
  method?: string;
  authenticated?: boolean;
  queryStringParameters?:
    Record<
      string,
      string
    >;
}

function event(
  input:
    EventInput = {},
): APIGatewayProxyEventV2 {
  const method =
    input.method ?? "GET";

  const path =
    "/api/me/investment-accounts";

  return {
    version: "2.0",
    routeKey:
      `${method} ${path}`,
    rawPath: path,
    rawQueryString: "",
    cookies:
      input.authenticated === false
        ? []
        : [
            "__Host-sntimnt_session=session-id",
          ],
    headers: {
      host:
        "app.example.com",
    },
    queryStringParameters:
      input.queryStringParameters,
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
        protocol:
          "HTTP/1.1",
        sourceIp:
          "127.0.0.1",
        userAgent:
          "vitest",
      },
      requestId:
        "api-request-id",
      routeKey:
        `${method} ${path}`,
      stage: "$default",
      time:
        "06/Aug/2026:01:00:00 +0000",
      timeEpoch:
        1_786_000_000_000,
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function body<T>(
  response:
    APIGatewayProxyStructuredResultV2,
): T {
  if (!response.body) {
    throw new Error(
      "Expected a JSON body.",
    );
  }

  return JSON.parse(
    response.body,
  ) as T;
}

describe(
  "owner-scoped investment account HTTP boundary",
  () => {
    beforeEach(async () => {
      vi.clearAllMocks();

      runtime.store.getSession
        .mockResolvedValue(
          session(),
        );

      runtime.store.deleteSession
        .mockResolvedValue(null);

      businessRuntime.store
        .listInvestmentAccounts
        .mockResolvedValue([]);

      const module =
        await import(
          "../src/handler.js"
        );

      invokeHandler =
        module.handler;
    });

    it("returns 401 without an opaque session cookie", async () => {
      const response =
        await invokeHandler(
          event({
            authenticated:
              false,
          }),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expect(
        body<{
          message: string;
        }>(response),
      ).toEqual({
        message:
          "Authentication is required.",
      });

      expect(
        runtime.store.getSession,
      ).not.toHaveBeenCalled();

      expect(
        businessRuntime.store
          .listInvestmentAccounts,
      ).not.toHaveBeenCalled();
    });

    it("returns 401 when the server-side session is missing", async () => {
      runtime.store.getSession
        .mockResolvedValueOnce(null);

      const response =
        await invokeHandler(
          event(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expect(
        businessRuntime.store
          .listInvestmentAccounts,
      ).not.toHaveBeenCalled();
    });

    it.each([
      "admin",
      "operations",
    ] as const)(
      "returns 403 without granting the %s role implicit investor access",
      async (role: UserRole) => {
        runtime.store.getSession
          .mockResolvedValueOnce(
            session([role]),
          );

        const response =
          await invokeHandler(
            event(),
            context,
          );

        expect(
          response.statusCode,
        ).toBe(403);

        expect(
          body<{
            message: string;
          }>(response),
        ).toEqual({
          message:
            "The requested resource is not permitted.",
        });

        expect(
          businessRuntime.store
            .listInvestmentAccounts,
        ).not.toHaveBeenCalled();
      },
    );

    it("fails closed when the canonical session subject is missing", async () => {
      runtime.store.getSession
        .mockResolvedValueOnce(
          session(
            ["investor"],
            {
              subject: "",
            },
          ),
        );

      const response =
        await invokeHandler(
          event(),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(401);

      expect(
        businessRuntime.store
          .listInvestmentAccounts,
      ).not.toHaveBeenCalled();
    });

    it("derives the owner scope from the session and ignores caller-supplied owner identifiers", async () => {
      const accounts:
        InvestmentAccountSummary[] = [
          {
            id:
              "acct_000000000001",
            displayName:
              "Primary Investment Account",
            status: "active",
            baseCurrency: "USD",
            createdAt:
              "2026-08-05T20:00:00.000Z",
            updatedAt:
              "2026-08-05T20:30:00.000Z",
          },
        ];

      businessRuntime.store
        .listInvestmentAccounts
        .mockResolvedValueOnce(
          accounts,
        );

      const response =
        await invokeHandler(
          event({
            queryStringParameters: {
              ownerId:
                "other-user",
              userId:
                "other-user",
              accountId:
                "other-account",
            },
          }),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(200);

      expect(
        businessRuntime.store
          .listInvestmentAccounts,
      ).toHaveBeenCalledTimes(1);

      expect(
        businessRuntime.store
          .listInvestmentAccounts,
      ).toHaveBeenCalledWith({
        status: "allow",
        ownerPartitionKey:
          "BUSINESS#OWNER#XKkzH4i6IJ7oBTSPcL88KKr-qWsX35sJjZsR3Q7lsCY",
      });

      expect(
        body<{
          accounts:
            InvestmentAccountSummary[];
        }>(response),
      ).toEqual({
        accounts,
      });

      expect(
        response.headers
          ?.[
            "Cache-Control"
          ],
      ).toBe(
        "no-store, max-age=0",
      );
    });

    it("returns a generic 503 without logging business data when persistence fails", async () => {
      businessRuntime.store
        .listInvestmentAccounts
        .mockRejectedValueOnce(
          new Error(
            "DynamoDB unavailable for acct_000000000001",
          ),
        );

      const consoleError =
        vi.spyOn(
          console,
          "error",
        ).mockImplementation(
          () => undefined,
        );

      try {
        const response =
          await invokeHandler(
            event(),
            context,
          );

        expect(
          response.statusCode,
        ).toBe(503);

        expect(
          body<{
            message: string;
          }>(response),
        ).toEqual({
          message:
            "Investment account data is temporarily unavailable.",
        });

        expect(
          consoleError,
        ).toHaveBeenCalledWith(
          "business_investment_accounts_failed",
          {
            requestId:
              "api-request-id",
            errorName:
              "Error",
          },
        );

        expect(
          JSON.stringify(
            consoleError.mock.calls,
          ),
        ).not.toContain(
          "acct_000000000001",
        );
      } finally {
        consoleError.mockRestore();
      }
    });

    it("does not expose the read handler through a state-changing method", async () => {
      const response =
        await invokeHandler(
          event({
            method: "POST",
          }),
          context,
        );

      expect(
        response.statusCode,
      ).toBe(404);

      expect(
        businessRuntime.store
          .listInvestmentAccounts,
      ).not.toHaveBeenCalled();
    });
  },
);