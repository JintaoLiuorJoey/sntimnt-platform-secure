const CSRF_COOKIE_NAMES = ["__Host-sntimnt_csrf", "sntimnt_csrf"] as const;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function readCsrfToken(cookieHeader = document.cookie): string | null {
  const cookies = new Map(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator > 0
          ? [part.slice(0, separator), part.slice(separator + 1)]
          : [part, ""];
      }),
  );

  for (const name of CSRF_COOKIE_NAMES) {
    const token = cookies.get(name);
    if (token) return token;
  }
  return null;
}

export function csrfHeadersForMethod(method = "GET"): Record<string, string> {
  if (SAFE_METHODS.has(method.toUpperCase())) return {};
  const token = readCsrfToken();
  return token ? { "X-CSRF-Token": token } : {};
}
