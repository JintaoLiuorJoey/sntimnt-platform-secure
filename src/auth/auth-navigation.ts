export type LoginNoticeReason =
  | "authentication-failed"
  | "logged-out"
  | "logout-incomplete"
  | "session-expired"
  | "try-again-later";

const DEFAULT_RETURN_TO = "/dashboard";
const AUTH_BOUNDARY_PATHS = new Set([
  "/login",
  "/401",
  "/403",
  "/unauthorized",
  "/forbidden",
]);

export function safeInternalReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_RETURN_TO;
  }

  try {
    const baseUrl = new URL("https://app.example.invalid");
    const parsed = new URL(value, baseUrl);
    if (parsed.origin !== baseUrl.origin || AUTH_BOUNDARY_PATHS.has(parsed.pathname)) {
      return DEFAULT_RETURN_TO;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

export function buildLoginEndpoint(apiBaseUrl: string, returnTo: string): string {
  const endpoint = new URL("/api/auth/login", `${apiBaseUrl.replace(/\/$/, "")}/`);
  endpoint.searchParams.set("returnTo", safeInternalReturnTo(returnTo));
  return endpoint.toString();
}

export function buildLoginPagePath(
  returnTo: string,
  reason?: LoginNoticeReason,
): string {
  const params = new URLSearchParams({ returnTo: safeInternalReturnTo(returnTo) });
  if (reason) params.set("reason", reason);
  return `/login?${params.toString()}`;
}

export function loginNoticeFor(reason: string | null): string | null {
  switch (reason) {
    case "session-expired":
      return "Your session ended. Sign in again to continue.";
    case "logged-out":
      return "You have been signed out.";
    case "logout-incomplete":
      return "We could not confirm server sign-out. Close this browser before leaving this device.";
    case "try-again-later":
      return "Sign-in is temporarily limited. Please wait and try again.";
    case "authentication-failed":
      return "We could not complete sign-in. Please try again.";
    default:
      return null;
  }
}
