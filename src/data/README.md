# Production data layer

Production-facing API clients, DTOs, validation schemas, and query hooks belong here.

Rules:

- Do not import from `src/mocks`.
- Treat every API response as untrusted and validate it before use.
- Browser requests use secure server-managed sessions (`credentials: include`).
- Never put secrets in `VITE_*` variables; those values are bundled into client code.
