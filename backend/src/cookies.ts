import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { AuthConfig } from "./config.js";

export interface CookieNames {
  session: string;
  csrf: string;
  oauth: string;
}

export function cookieNames(config: AuthConfig): CookieNames {
  const prefix = config.cookieSecure ? "__Host-" : "";
  return {
    session: `${prefix}sntimnt_session`,
    csrf: `${prefix}sntimnt_csrf`,
    oauth: `${prefix}sntimnt_oauth`,
  };
}

export function parseCookies(event: APIGatewayProxyEventV2): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawCookie of event.cookies ?? []) {
    const separator = rawCookie.indexOf("=");
    if (separator <= 0) continue;
    const name = rawCookie.slice(0, separator).trim();
    const value = rawCookie.slice(separator + 1).trim();
    if (name) result.set(name, value);
  }
  return result;
}

interface SerializeCookieOptions {
  httpOnly?: boolean;
  maxAge: number;
}

function serializeCookie(
  name: string,
  value: string,
  config: AuthConfig,
  options: SerializeCookieOptions,
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`,
    "SameSite=Lax",
  ];

  if (config.cookieSecure) parts.push("Secure");
  if (options.httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}

export function oauthCookie(config: AuthConfig, binding: string): string {
  return serializeCookie(cookieNames(config).oauth, binding, config, {
    httpOnly: true,
    maxAge: config.oauthTransactionTtlSeconds,
  });
}

export function sessionCookies(
  config: AuthConfig,
  sessionId: string,
  csrfToken: string,
  maxAge: number,
): string[] {
  const names = cookieNames(config);
  return [
    serializeCookie(names.session, sessionId, config, { httpOnly: true, maxAge }),
    serializeCookie(names.csrf, csrfToken, config, { maxAge }),
  ];
}

export function clearAuthCookies(config: AuthConfig): string[] {
  const names = cookieNames(config);
  return [
    serializeCookie(names.session, "", config, { httpOnly: true, maxAge: 0 }),
    serializeCookie(names.csrf, "", config, { maxAge: 0 }),
    serializeCookie(names.oauth, "", config, { httpOnly: true, maxAge: 0 }),
  ];
}

export function clearOAuthCookie(config: AuthConfig): string {
  return serializeCookie(cookieNames(config).oauth, "", config, {
    httpOnly: true,
    maxAge: 0,
  });
}
