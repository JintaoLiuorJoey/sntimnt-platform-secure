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
