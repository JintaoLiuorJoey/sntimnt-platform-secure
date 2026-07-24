import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import type { AuthConfig } from "../src/config.js";
import { csrfIsValid } from "../src/csrf.js";
import { sha256 } from "../src/security.js";
import type { SessionRecord } from "../src/types.js";

const config = {
  appOrigin: "https://app.example.com",
  cookieSecure: true,
} as AuthConfig;

const session = {
  csrfHash: sha256("csrf-token"),
} as SessionRecord;

function event(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /api/auth/logout",
    rawPath: "/api/auth/logout",
    rawQueryString: "",
    headers: {
      origin: "https://app.example.com",
      "x-csrf-token": "csrf-token",
    },
    cookies: ["__Host-sntimnt_csrf=csrf-token"],
    requestContext: {
      accountId: "123456789012",
      apiId: "api",
      domainName: "app.example.com",
      domainPrefix: "app",
      http: {
        method: "POST",
        path: "/api/auth/logout",
        protocol: "HTTP/1.1",
        sourceIp: "203.0.113.10",
        userAgent: "test",
      },
      requestId: "request-id",
      routeKey: "POST /api/auth/logout",
      stage: "$default",
      time: "",
      timeEpoch: 0,
    },
    isBase64Encoded: false,
    ...overrides,
  };
}

describe("CSRF verification", () => {
  it("requires matching Origin, cookie, header, and session-bound hash", () => {
    expect(csrfIsValid(event(), config, session)).toBe(true);
  });

  it("rejects a cross-origin request", () => {
    expect(
      csrfIsValid(
        event({ headers: { origin: "https://evil.example", "x-csrf-token": "csrf-token" } }),
        config,
        session,
      ),
    ).toBe(false);
  });

  it("rejects a token that is not bound to the server session", () => {
    expect(
      csrfIsValid(
        event({
          headers: {
            origin: "https://app.example.com",
            "x-csrf-token": "different-token",
          },
          cookies: ["__Host-sntimnt_csrf=different-token"],
        }),
        config,
        session,
      ),
    ).toBe(false);
  });
});
