import { runtimeConfig } from "@/config/runtime";
import { authSessionSchema, type AuthSession } from "@/auth/auth-types";
import { csrfHeadersForMethod } from "@/auth/csrf-cookie";

const SESSION_PATH = "/api/auth/session";
const REFRESH_PATH = "/api/auth/refresh";
const LOGOUT_PATH = "/api/auth/logout";
const TOTP_START_PATH = "/api/auth/mfa/totp/start";
const TOTP_COMPLETE_PATH = "/api/auth/mfa/totp/complete";

const TOTP_SECRET_PATTERN = /^[A-Z2-7]{16,128}$/;

const apiUrl = (path: string) => `${runtimeConfig.apiBaseUrl}${path}`;

export class SessionApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SessionApiError";
    this.status = status;
  }
}

async function apiError(response: Response, fallback: string): Promise<SessionApiError> {
  let message = fallback;

  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      message = body.message;
    }
  } catch {
    // Error responses are not trusted to contain JSON.
  }

  return new SessionApiError(message, response.status);
}

function totpHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...csrfHeadersForMethod("POST"),
  };
}

async function parseSessionResponse(response: Response): Promise<AuthSession> {
  const parsed = authSessionSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new SessionApiError("The server returned an invalid session response.", 502);
  }

  if (Date.parse(parsed.data.expiresAt) <= Date.now()) {
    throw new SessionApiError("The server returned an expired session.", 401);
  }

  return parsed.data;
}

export async function fetchSession(signal?: AbortSignal): Promise<AuthSession | null> {
  if (!runtimeConfig.isApi) {
    return null;
  }

  const response = await fetch(apiUrl(SESSION_PATH), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new SessionApiError("Unable to load the current session.", response.status);
  }

  return parseSessionResponse(response);
}

export async function renewSession(): Promise<AuthSession> {
  if (!runtimeConfig.isApi) {
    throw new SessionApiError("Session renewal is unavailable in demo mode.", 400);
  }

  const response = await fetch(apiUrl(REFRESH_PATH), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeadersForMethod("POST"),
    },
  });

  if (!response.ok) {
    throw new SessionApiError("Unable to renew the current session.", response.status);
  }

  return parseSessionResponse(response);
}

export async function endSession(): Promise<void> {
  if (!runtimeConfig.isApi) {
    return;
  }

  const response = await fetch(apiUrl(LOGOUT_PATH), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...csrfHeadersForMethod("POST"),
    },
  });

  if (!response.ok && response.status !== 401) {
    throw new SessionApiError("Unable to end the current session.", response.status);
  }
}

export async function startTotpEnrollment(): Promise<string> {
  if (!runtimeConfig.isApi) {
    throw new SessionApiError("MFA enrollment is unavailable in demo mode.", 400);
  }

  const response = await fetch(apiUrl(TOTP_START_PATH), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: totpHeaders(),
    body: "{}",
  });

  if (!response.ok) {
    throw await apiError(response, "Unable to start MFA enrollment.");
  }

  const body = (await response.json()) as { secretCode?: unknown };
  if (
    typeof body.secretCode !== "string" ||
    !TOTP_SECRET_PATTERN.test(body.secretCode)
  ) {
    throw new SessionApiError("The server returned an invalid MFA secret.", 502);
  }

  return body.secretCode;
}

export async function completeTotpEnrollment(userCode: string): Promise<void> {
  if (!/^\d{6}$/.test(userCode)) {
    throw new SessionApiError("Enter a valid six-digit verification code.", 400);
  }
  if (!runtimeConfig.isApi) {
    throw new SessionApiError("MFA enrollment is unavailable in demo mode.", 400);
  }

  const response = await fetch(apiUrl(TOTP_COMPLETE_PATH), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: totpHeaders(),
    body: JSON.stringify({ userCode }),
  });

  if (!response.ok) {
    throw await apiError(response, "Unable to complete MFA enrollment.");
  }
  if (response.status !== 204) {
    throw new SessionApiError("The server returned an invalid MFA response.", 502);
  }
}
