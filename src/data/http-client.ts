import { notifySessionExpired } from "@/auth/session-events";
import { runtimeConfig } from "@/config/runtime";
import { csrfHeadersForMethod } from "@/auth/csrf-cookie";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiRequestOptions extends RequestInit {
  auth?: "required" | "optional";
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (!runtimeConfig.isApi) {
    throw new Error("The production API client cannot be used while mock data is active.");
  }

  const { auth = "required", ...init } = options;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetch(`${runtimeConfig.apiBaseUrl}${normalizedPath}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...csrfHeadersForMethod(method),
      ...init.headers,
    },
  });

  if (response.status === 401 && auth === "required") {
    notifySessionExpired();
  }

  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}.`, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
