import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

const BASE_HEADERS = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
});

export function jsonResponse(
  statusCode: number,
  body: unknown,
  cookies: string[] = [],
  headers: Record<string, string> = {},
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
    cookies,
    body: JSON.stringify(body),
  };
}

export function emptyResponse(
  statusCode: number,
  cookies: string[] = [],
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: BASE_HEADERS,
    cookies,
    body: "",
  };
}

export function redirectResponse(
  location: string,
  cookies: string[] = [],
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 303,
    headers: {
      ...BASE_HEADERS,
      Location: location,
    },
    cookies,
    body: "",
  };
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return jsonResponse(
    429,
    { message: "Sign-in is temporarily limited. Please wait and try again." },
    [],
    { "Retry-After": String(retryAfterSeconds) },
  );
}

export function clientIp(event: APIGatewayProxyEventV2): string {
  return event.requestContext.http.sourceIp || "unknown";
}

export function requestOrigin(event: APIGatewayProxyEventV2): string | null {
  const origin = event.headers.origin;
  if (origin) return origin;

  const referer = event.headers.referer;
  if (!referer) return null;

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
