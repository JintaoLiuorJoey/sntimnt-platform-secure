import { runtimeConfig } from "@/config/runtime";
import { authSessionSchema, type AuthSession } from "@/auth/auth-types";

const SESSION_PATH = "/api/auth/session";
const LOGOUT_PATH = "/api/auth/logout";

const apiUrl = (path: string) => `${runtimeConfig.apiBaseUrl}${path}`;

export class SessionApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SessionApiError";
    this.status = status;
  }
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

  const parsed = authSessionSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new SessionApiError("The server returned an invalid session response.", 502);
  }

  if (Date.parse(parsed.data.expiresAt) <= Date.now()) {
    return null;
  }

  return parsed.data;
}

export async function endSession(): Promise<void> {
  if (!runtimeConfig.isApi) {
    return;
  }

  const response = await fetch(apiUrl(LOGOUT_PATH), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok && response.status !== 401) {
    throw new SessionApiError("Unable to end the current session.", response.status);
  }
}
