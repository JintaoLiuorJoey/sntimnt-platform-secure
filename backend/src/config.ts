function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function positiveInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = environment[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function integerInRange(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = environment[name]?.trim();
  const value = raw ? Number(raw) : fallback;

  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function booleanValue(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: boolean,
): boolean {
  const raw = environment[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function normalizedUrl(value: string, name: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
}

export type AuthConfig = ReturnType<typeof loadConfig>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  const appOrigin = new URL(normalizedUrl(required(environment, "APP_ORIGIN"), "APP_ORIGIN")).origin;
  const callbackUrl = new URL(
    normalizedUrl(required(environment, "AUTH_CALLBACK_URL"), "AUTH_CALLBACK_URL"),
  );

  if (callbackUrl.origin !== appOrigin) {
    throw new Error("AUTH_CALLBACK_URL must use the same origin as APP_ORIGIN.");
  }

  return Object.freeze({
    region: required(environment, "AWS_REGION"),
    tableName: required(environment, "AUTH_TABLE_NAME"),
    kmsKeyId: required(environment, "AUTH_KMS_KEY_ID"),
    userPoolId: required(environment, "COGNITO_USER_POOL_ID"),
    clientId: required(environment, "COGNITO_CLIENT_ID"),
    cognitoDomain: normalizedUrl(
      required(environment, "COGNITO_DOMAIN"),
      "COGNITO_DOMAIN",
    ),
    cognitoIssuer: normalizedUrl(
      required(environment, "COGNITO_ISSUER"),
      "COGNITO_ISSUER",
    ),
    appOrigin,
    callbackUrl: callbackUrl.toString(),
    absoluteTtlSeconds: positiveInteger(
      environment,
      "SESSION_ABSOLUTE_TTL_SECONDS",
      28_800,
    ),
    idleTtlSeconds: positiveInteger(environment, "SESSION_IDLE_TTL_SECONDS", 1_800),
    recentAuthenticationMaxAgeSeconds: integerInRange(
      environment,
      "RECENT_AUTHENTICATION_MAX_AGE_SECONDS",
      300,
      60,
      900,
    ),
    oauthTransactionTtlSeconds: positiveInteger(
      environment,
      "OAUTH_TRANSACTION_TTL_SECONDS",
      600,
    ),
    loginRateLimitCount: positiveInteger(environment, "LOGIN_RATE_LIMIT_COUNT", 20),
    loginRateLimitWindowSeconds: positiveInteger(
      environment,
      "LOGIN_RATE_LIMIT_WINDOW_SECONDS",
      300,
    ),
    cookieSecure: booleanValue(environment, "COOKIE_SECURE", true),
  });
}
