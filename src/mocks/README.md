# Mock data boundary

This directory contains fictional data used only by the local development server and the
explicit `npm run build:demo` command.

A protected build (`npm run build`) fails if any module from this directory reaches the
output bundle. Do not deploy a demo build to production.

Migration rule: move existing inline business data into this directory first, then replace
its consumers with production API-backed hooks one domain at a time.
