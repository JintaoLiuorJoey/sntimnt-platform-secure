# SNTIMNT authentication BFF

This package implements the server-controlled browser session boundary. The browser receives only:

- an opaque `HttpOnly` session cookie;
- a non-HttpOnly CSRF cookie whose hash is bound to the server-side session;
- a validated session response containing user ID, display data, roles, and expiry timestamps.

Cognito ID, access, and refresh tokens are never returned to the React application. Refresh tokens are encrypted with AWS KMS before they are stored in DynamoDB. KMS encryption-context identifiers are hashed so raw session IDs and OAuth state values are not copied into KMS audit metadata.

## Endpoints

- `GET /api/auth/login`
- `GET /api/auth/callback`
- `GET /api/auth/session`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

## Security properties

- Authorization Code + PKCE and `nonce`.
- One-time OAuth transactions with a browser-binding cookie.
- Opaque session IDs; only SHA-256 hashes are used as DynamoDB keys.
- `HttpOnly`, `Secure`, `SameSite=Lax`, host-only cookies.
- Origin checking plus a session-bound double-submit CSRF token.
- 30-minute idle timeout and 8-hour absolute timeout by default. The browser refreshes only after recent visible user activity; successful refresh rotates the session and advances the server-side idle deadline without extending the absolute deadline.
- Session ID and CSRF rotation on refresh.
- Cognito refresh-token rotation and token revocation on logout.
- Fail-closed role extraction from `cognito:groups`.
- Generic authentication errors; no user-enumeration messages.
- Atomic DynamoDB login-initiation rate counter, plus API Gateway throttling. Add AWS WAF rate rules before production.

## Same-origin requirement

Production must route `/api/*` through the same CloudFront distribution as the SPA. Do not point the browser directly at an unrelated `execute-api` origin and weaken the cookie policy to compensate.

CloudFront must:

1. send `/api/*` to API Gateway;
2. disable caching for auth/API responses;
3. forward cookies, query strings, `Origin`, `Referer`, `Content-Type`, `Accept`, and `X-CSRF-Token`;
4. use HTTPS to the viewer and origin.

## Runtime dependencies

The Lambda targets Node.js 22 and bundles exact versions of the DynamoDB and KMS AWS SDK v3 clients. This keeps the deployed dependency graph reproducible instead of inheriting whichever SDK minor version happens to be present in the managed runtime.

## Local validation

```powershell
cd backend
npm ci
npm run validate
sam validate --lint
```

`sam local start-api` uses HTTP and cannot exercise `Secure` cookies as a real browser deployment would. Unit-test locally, then validate the full flow in a private HTTPS AWS development environment.

## Deployment prerequisites

- AWS CLI and SAM CLI authenticated to a non-production AWS account.
- An HTTPS application origin already routed through CloudFront.
- A globally unique Cognito domain prefix.

```powershell
cd backend
Copy-Item .\samconfig.toml.example .\samconfig.toml
# Edit AppOrigin, region, and CognitoDomainPrefix.
sam build
sam deploy --config-env dev
```

After deployment, create a user and add exactly the intended group. Users with no allowlisted Cognito group are rejected. The API Gateway endpoint must not be treated as the public application URL; production browser traffic must use the CloudFront application origin so cookie, CSRF, and redirect-origin assumptions remain valid.

```powershell
aws cognito-idp admin-create-user `
  --user-pool-id <USER_POOL_ID> `
  --username investor@example.com `
  --user-attributes Name=email,Value=investor@example.com Name=email_verified,Value=true

aws cognito-idp admin-add-user-to-group `
  --user-pool-id <USER_POOL_ID> `
  --username investor@example.com `
  --group-name investor
```
