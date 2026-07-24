import { createPublicKey, verify as verifySignature } from "node:crypto";
import type { AuthConfig } from "./config.js";
import { identityFromClaims, type IdTokenClaims, type VerifiedIdentity } from "./identity.js";
import { pkceChallenge } from "./security.js";

interface TokenEndpointResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface JwtHeader {
  alg: string;
  kid: string;
}

interface CognitoJwk extends JsonWebKey {
  alg?: string;
  kid?: string;
  use?: string;
}

interface JwkSet {
  keys: CognitoJwk[];
}

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

let cachedJwks: { expiresAt: number; value: JwkSet } | null = null;

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

function isTokenResponse(value: unknown): value is TokenEndpointResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id_token === "string" &&
    typeof candidate.access_token === "string" &&
    typeof candidate.expires_in === "number" &&
    typeof candidate.token_type === "string" &&
    (candidate.refresh_token === undefined || typeof candidate.refresh_token === "string")
  );
}

export class CognitoService {
  constructor(private readonly config: AuthConfig) {}

  buildAuthorizeUrl(
    state: string,
    nonce: string,
    codeVerifier: string,
  ): string {
    const url = new URL("/oauth2/authorize", `${this.config.cognitoDomain}/`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.callbackUrl);
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", pkceChallenge(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string, codeVerifier: string): Promise<CognitoTokens> {
    return this.tokenRequest(
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.config.clientId,
        code,
        redirect_uri: this.config.callbackUrl,
        code_verifier: codeVerifier,
      }),
    );
  }

  async refresh(refreshToken: string): Promise<CognitoTokens> {
    return this.tokenRequest(
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.config.clientId,
        refresh_token: refreshToken,
      }),
    );
  }

  async revoke(refreshToken: string): Promise<void> {
    const response = await fetch(`${this.config.cognitoDomain}/oauth2/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: refreshToken,
        client_id: this.config.clientId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cognito token revocation failed with status ${response.status}.`);
    }
  }

  async verifyIdentity(
    idToken: string,
    expectedNonce?: string,
    expectedSubject?: string,
  ): Promise<VerifiedIdentity> {
    const claims = await this.verifyIdToken(idToken);

    if (expectedNonce && claims.nonce !== expectedNonce) {
      throw new Error("ID token nonce did not match the OAuth transaction.");
    }
    if (expectedSubject && claims.sub !== expectedSubject) {
      throw new Error("Refreshed identity subject changed unexpectedly.");
    }

    return identityFromClaims(claims);
  }

  private async tokenRequest(body: URLSearchParams): Promise<CognitoTokens> {
    const response = await fetch(`${this.config.cognitoDomain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error(`Cognito token exchange failed with status ${response.status}.`);
    }

    const parsed: unknown = await response.json();
    if (!isTokenResponse(parsed)) {
      throw new Error("Cognito returned a malformed token response.");
    }

    return {
      idToken: parsed.id_token,
      accessToken: parsed.access_token,
      ...(parsed.refresh_token ? { refreshToken: parsed.refresh_token } : {}),
      expiresIn: parsed.expires_in,
    };
  }

  private async verifyIdToken(token: string): Promise<IdTokenClaims> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed ID token.");

    const [headerSegment, payloadSegment, signatureSegment] = parts;
    if (!headerSegment || !payloadSegment || !signatureSegment) {
      throw new Error("Malformed ID token.");
    }

    const header = decodeJsonSegment<JwtHeader>(headerSegment);
    const claims = decodeJsonSegment<IdTokenClaims>(payloadSegment);
    if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported ID token.");

    let jwks = await this.getJwks();
    let jwk = jwks.keys.find((candidate) => candidate.kid === header.kid);
    if (!jwk) {
      jwks = await this.getJwks(true);
      jwk = jwks.keys.find((candidate) => candidate.kid === header.kid);
    }
    if (!jwk) throw new Error("ID token signing key was not found.");
    if (jwk.kty !== "RSA" || (jwk.alg && jwk.alg !== "RS256") || (jwk.use && jwk.use !== "sig")) {
      throw new Error("ID token signing key is invalid.");
    }

    const publicKey = createPublicKey({
      key: jwk as any,
      format: "jwk",
    });
    const signatureValid = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${headerSegment}.${payloadSegment}`, "utf8"),
      publicKey,
      Buffer.from(signatureSegment, "base64url"),
    );
    if (!signatureValid) throw new Error("ID token signature is invalid.");

    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== this.config.cognitoIssuer) throw new Error("ID token issuer is invalid.");
    if (claims.aud !== this.config.clientId) throw new Error("ID token audience is invalid.");
    if (claims.token_use !== "id") throw new Error("Unexpected Cognito token use.");
    if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("ID token expired.");
    if (typeof claims.iat !== "number" || claims.iat > now + 60) {
      throw new Error("ID token issue time is invalid.");
    }
    if (typeof claims.sub !== "string" || !claims.sub) throw new Error("ID token subject is invalid.");

    return claims;
  }

  private async getJwks(forceRefresh = false): Promise<JwkSet> {
    const now = Date.now();
    if (!forceRefresh && cachedJwks && cachedJwks.expiresAt > now) {
      return cachedJwks.value;
    }

    const response = await fetch(`${this.config.cognitoIssuer}/.well-known/jwks.json`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Unable to load Cognito signing keys.");

    const value = (await response.json()) as JwkSet;
    if (!Array.isArray(value.keys)) throw new Error("Cognito returned malformed signing keys.");
    cachedJwks = { value, expiresAt: now + 6 * 60 * 60 * 1000 };
    return value;
  }
}
