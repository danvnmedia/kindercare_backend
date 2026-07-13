---
id: 20260713-0811-use-proprietary-kindercare-production-identity-and-deployment-defaults
title: Use proprietary Kindercare production identity and deployment defaults
status: accepted
supersedes: []
supersededBy: []
tags:
  - production
  - identity
  - licensing
  - deployment
  - postgresql
sources:
  - '@task-zin039'
  - '@doc/guides/backend-dev-deployment'
  - package.json
  - README.md
  - docker-compose.prod.yml
relatedDocs:
  - guides/backend-dev-deployment
relatedTasks:
  - zin039
createdAt: '2026-07-13T12:11:30.146Z'
updatedAt: '2026-07-13T12:11:30.146Z'
---

## Context

The backend retained the original NestJS boilerplate npm identity, owner links, and PostgreSQL database defaults even though the repository and API are now Kindercare/DHA-owned. The package and README also had conflicting MIT versus UNLICENSED declarations.

## Decision

Use npm package name `kindercare-backend`, DHA Enterprise ownership/support links, `private: true`, and `license: UNLICENSED`. Preserve upstream `howznguyen` attribution in README acknowledgements and Git history. Use `kindercare_backend` as the fresh-deployment PostgreSQL default, make health checks consume configured user/database values, and require an explicit production database password.

## Alternatives Considered

Retaining the public boilerplate identity was rejected because it misrepresented the deployed product and current maintainer. Publishing under MIT was rejected because the user explicitly approved proprietary/UNLICENSED distribution. Rewriting Git history or deleting upstream attribution was rejected because authorship and provenance should remain intact.

## Consequences

Existing ignored `.env` files and persistent PostgreSQL databases/volumes are not renamed automatically. Operators must update secret-managed deployment configuration and explicitly migrate or rename an existing database when adopting the new identifier. New production Compose deployments fail configuration when `POSTGRES_PASSWORD` is empty.
