import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COGNITO_OAUTH_SCOPES,
  CognitoService,
} from "../src/cognito.js";
import type { AuthConfig } from "../src/config.js";

const config = {
  clientId: "client-id",
  callbackUrl: "https://app.example.com/api/auth/callback",
  cognitoDomain:
    "https://example.auth.us-east-1.amazoncognito.com",
} as AuthConfig;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Cognito OAuth scope boundary", () => {
  it("requests the exact minimum scopes required by the BFF", () => {
    const url = new URL(
      new CognitoService(config).buildAuthorizeUrl(
        "state-value",
        "nonce-value",
        "verifier-value",
      ),
    );

    expect(
      url.searchParams.get("scope")?.split(" "),
    ).toEqual([...COGNITO_OAUTH_SCOPES]);

    expect(url.searchParams.getAll("scope")).toHaveLength(1);
  });

  it("requires interactive authentication for every sign-in request", () => {
    const url = new URL(
      new CognitoService(config).buildAuthorizeUrl(
        "state-value",
        "nonce-value",
        "verifier-value",
      ),
    );

    expect(
      url.searchParams.get("prompt"),
    ).toBe("login");

    expect(
      url.searchParams.getAll("prompt"),
    ).toEqual(["login"]);
  });

  it("keeps the infrastructure app-client scopes synchronized", () => {
    const template = fs
      .readFileSync(
        new URL("../template.yaml", import.meta.url),
        "utf8",
      )
      .replace(/\r\n/g, "\n");

    const scopeBlock = template.match(
      /      AllowedOAuthScopes:\n((?:        - [^\n]+\n)+)/,
    )?.[1];

    expect(scopeBlock).toBeDefined();

    const configuredScopes = scopeBlock
      ?.trim()
      .split("\n")
      .map((line) => line.trim().replace(/^- /, ""));

    expect(configuredScopes).toEqual([
      ...COGNITO_OAUTH_SCOPES,
    ]);
  });

  it("retrieves and exposes rotated tokens through the OAuth token endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id_token: "next-id-token",
          access_token: "next-access-token",
          refresh_token: "next-refresh-token",
          expires_in: 3_600,
          token_type: "Bearer",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new CognitoService(config).refresh(
        "current-refresh-token",
      ),
    ).resolves.toEqual({
      idToken: "next-id-token",
      accessToken: "next-access-token",
      refreshToken: "next-refresh-token",
      expiresIn: 3_600,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = fetchMock.mock.calls[0];

    if (!call) {
      throw new Error("The OAuth token endpoint was not called.");
    }

    const [requestUrl, requestInit] = call as [
      string,
      RequestInit,
    ];

    expect(requestUrl).toBe(
      "https://example.auth.us-east-1.amazoncognito.com/oauth2/token",
    );

    expect(requestInit.method).toBe("POST");
    expect(requestInit.body).toBeInstanceOf(URLSearchParams);

    const body = requestInit.body as URLSearchParams;

    expect(Object.fromEntries(body.entries())).toEqual({
      grant_type: "refresh_token",
      client_id: "client-id",
      refresh_token: "current-refresh-token",
    });

    expect(body.has("scope")).toBe(false);
    expect(body.has("prompt")).toBe(false);
  });
});
