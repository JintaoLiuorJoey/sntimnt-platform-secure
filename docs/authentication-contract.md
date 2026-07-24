# Authentication boundary contract

The browser must never create an authenticated user, derive a role from an email address, or store an access token in `localStorage` or `sessionStorage`.

## `GET /api/auth/login`

- Accepts only a server-validated internal `returnTo` path.
- Creates OAuth state, nonce, and PKCE values on the server.
- Stores transient verifier material in a short-lived `HttpOnly`, `Secure`, `SameSite=Lax` cookie or server-side session.
- Redirects to the approved Cognito authorization endpoint.
- Never accepts a password from the React application.
- Uses generic failures that do not reveal whether an email or account exists.

## Login rate limiting

The three-second browser cooldown only prevents accidental duplicate clicks. It is not a security control.

The BFF and AWS edge must enforce the real limit:

- Rate-limit `/api/auth/login`, callback failures, password recovery, and verification attempts.
- Combine IP/network signals with a non-sensitive device/session key; do not rely on an email alone.
- Return `429 Too Many Requests` with `Retry-After`, or redirect to `/login?reason=try-again-later` using a generic message.
- Apply exponential delays and monitoring for credential stuffing patterns.
- Never vary the response in a way that confirms whether an account exists.

## `GET /api/auth/session`

- Returns `200` with the validated session contract for an active session.
- Returns `401` for missing, expired, revoked, or invalid sessions.
- Sends `Cache-Control: no-store`.
- The browser validates the response schema and treats malformed responses as unauthenticated.

## `POST /api/auth/logout`

- Revokes the server-side session or refresh token.
- Expires all authentication cookies.
- Validates the request `Origin` and the application CSRF control.
- Returns `204` on success and may return `401` when already signed out.
- The browser clears its in-memory identity even if the network request fails, but shows a generic incomplete-logout notice.

## Session expiry

- The frontend schedules expiry using the server-provided `expiresAt` timestamp.
- Any authenticated API request that returns `401` emits a session-expired event.
- Both paths clear in-memory identity and redirect to `/login` with a safe internal return path.
- Every backend endpoint must still authenticate and authorize each request; React route guards are not a server security boundary.

## Implemented BFF session flow

The `backend/` package implements these endpoints behind the same CloudFront application origin:

- `GET /api/auth/login` creates one-time OAuth state, nonce, a PKCE verifier, and an HttpOnly browser-binding cookie, then redirects to Cognito managed login.
- `GET /api/auth/callback` consumes the one-time transaction, verifies the browser binding, exchanges the code with PKCE, validates the Cognito ID-token signature and claims, and creates an opaque server-side session.
- `GET /api/auth/session` returns only the validated application user and session deadlines. Cognito tokens are not returned to React.
- `POST /api/auth/refresh` requires the Origin and session-bound CSRF token, rotates the Cognito refresh token, opaque session ID, and CSRF token, and never extends the absolute session deadline.
- `POST /api/auth/logout` requires CSRF protection, deletes the BFF session, revokes the Cognito refresh token, and expires all authentication cookies.

The session cookie is host-only, `HttpOnly`, `Secure`, and `SameSite=Lax`. A separate host-only CSRF cookie is readable by the React application, but its SHA-256 hash is stored in the server-side session. Unsafe requests must present the exact token in the `X-CSRF-Token` header and originate from the configured application origin.

## Session storage and expiry

DynamoDB stores only a SHA-256-derived key for each opaque session ID. Refresh tokens and PKCE verifiers are encrypted with KMS before storage. Records have TTL attributes, but every request also checks explicit deadlines because DynamoDB TTL deletion is asynchronous.

Default deadlines are:

- idle timeout: 30 minutes;
- absolute timeout: 8 hours;
- OAuth transaction timeout: 10 minutes.

The frontend sends refresh requests only when the document is visible and browser activity was recent. Successful refresh rotates session material and advances the idle deadline; it never changes the original absolute deadline. Expired, failed-refresh, and logout paths delete the BFF session and attempt Cognito token revocation.

## Server-controlled authorization

The BFF accepts application roles only from the signed `cognito:groups` claim and only from this allowlist:

- `investor`
- `operations`
- `admin`

A verified email and at least one allowlisted group are required. Email addresses, URL parameters, browser storage, and React state are never accepted as role evidence. Business APIs must still authenticate the opaque session and authorize the requested resource on every request.

## CloudFront requirement

The production value of `VITE_API_BASE_URL` is the HTTPS application origin, not a separate API origin. CloudFront must route `/api/*` to API Gateway without caching and forward cookies, query strings, and the required request headers. This preserves host-only cookie behavior and avoids weakening the CSRF model with cross-origin exceptions.
