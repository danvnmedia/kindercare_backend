---
title: Use proprietary Kindercare production identity and deployment defaults
description: Legacy combined decision for Kindercare package identity, proprietary licensing, attribution, and deployment defaults; its database-configuration portion is now superseded.
createdAt: '2026-07-13T12:11:30.146Z'
updatedAt: '2026-07-14T06:32:26.030Z'
tags:
  - production
  - identity
  - licensing
  - deployment
  - postgresql
---

## Context

The backend retained the original NestJS boilerplate npm identity, owner links, and PostgreSQL database defaults even though the repository and API are now Kindercare/DHA-owned. The package and README also had conflicting MIT versus UNLICENSED declarations.

## Decision

Use npm package name `kindercare-backend`, DHA Enterprise ownership/support links, `private: true`, and `license: UNLICENSED`. Preserve upstream `howznguyen` attribution in README acknowledgements and Git history. Use `kindercare_backend` as the fresh-deployment PostgreSQL default, make health checks consume configured user/database values, and require an explicit production database password.

## Alternatives Considered

Retaining the public boilerplate identity was rejected because it misrepresented the deployed product and current maintainer. Publishing under MIT was rejected because the user explicitly approved proprietary/UNLICENSED distribution. Rewriting Git history or deleting upstream attribution was rejected because authorship and provenance should remain intact.

## Consequences

Existing ignored `.env` files and persistent PostgreSQL databases/volumes are not renamed automatically. Operators must update secret-managed deployment configuration and explicitly migrate or rename an existing database when adopting the new identifier. New production Compose deployments fail configuration when `POSTGRES_PASSWORD` is empty.


## Supersession

The database-configuration portion of this legacy decision is superseded by accepted Decision `20260714-0231-use-connection-string-application-database-configuration`. Package identity, ownership, licensing, and attribution choices remain current.
