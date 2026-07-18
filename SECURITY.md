# Security Status

## Current status

This repository is undergoing security remediation and is not approved for
production deployment or for processing real customer, banking, investment,
authentication, or personal data.

All identities and banking details currently included in the user interface
are fictional demonstration data.

## Deployment restriction

Do not deploy this application to a public production environment until:

- Server-side authentication and authorization are implemented.
- Administrative routes are protected by server-side role checks.
- Sensitive actions require reauthentication and audit logging.
- Dependency, secret, SAST, and DAST scans pass.
- AWS infrastructure security controls are reviewed.
- Production data storage and encryption controls are implemented.

## Reporting security issues

Do not disclose suspected vulnerabilities in public GitHub issues. Report them
privately to the repository owner.
