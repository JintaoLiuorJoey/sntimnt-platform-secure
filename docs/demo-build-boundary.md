# Demo build boundary

Demo-only React modules belong under `src/demo`.

Protected production, staging, development-API, and test artifacts resolve
`@/demo-entry` to `src/demo-entry.tsx`, which renders nothing.

The demo banner is enabled only for:

- `npm run build:demo`
- a local development server using the mock data source

Protected builds reject any bundled module originating from:

- `src/demo`
- `src/mocks`

A demo build must never be promoted or deployed as a production artifact.

`scripts/build-dev.ps1` creates a production-mode artifact configured for
the real same-origin authentication API in the AWS dev environment.
