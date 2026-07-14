---
id: 20260714-0231-use-connection-string-application-database-configuration
title: Use connection-string application database configuration
status: accepted
supersedes: []
supersededBy: []
tags:
  - database
  - docker-compose
  - postgresql
  - neon
  - configuration
sources:
  - 'https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/'
  - 'https://docs.prisma.io/docs/orm/v6/overview/databases/neon'
  - 'https://neon.com/docs/connect/connection-pooling'
relatedDocs:
  - guides/backend-dev-deployment
  - decisions/20260713-0811-use-proprietary-kindercare-production-identity-and-deployment-defaults
relatedTasks:
  - 6xc266
createdAt: '2026-07-14T06:31:30.244Z'
updatedAt: '2026-07-14T06:31:30.244Z'
---

## Context

The app Compose stacks reconstructed DATABASE_URL from POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB and always started a local PostgreSQL container. That prevented provider-issued hosted URLs such as Neon pooled connections from reaching the application unchanged.

## Decision

Configure the application exclusively with a complete DATABASE_URL and pass it through unchanged in host and app Compose execution. App Compose stacks do not start PostgreSQL. Keep docker-compose.db.yml only as an explicit local fallback; its POSTGRES_* values initialize that optional server and are not application configuration.

## Alternatives Considered

Keeping split variables in every Compose stack was rejected because it couples application configuration to the bundled PostgreSQL container and discards hosted-provider URL options. Removing the local database fallback entirely was rejected because it remains useful for offline development.

## Consequences

Hosted PostgreSQL TLS, pooling, credentials, host, port, and database settings stay in one secret-managed URL. DATABASE_URL must be reachable from the app container. The optional local PostgreSQL image still uses POSTGRES_* initialization values when explicitly selected. A separate direct connection URL may be added later if migration tooling requires it.
