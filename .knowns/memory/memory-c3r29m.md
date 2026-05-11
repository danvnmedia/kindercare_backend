---
id: c3r29m
title: 'Raw SQL inserts must set updated_at explicitly for Prisma @updatedAt fields'
layer: project
category: pattern
tags:
  - prisma
  - raw-sql
  - seed
  - migration
createdAt: '2026-05-06T01:43:57.260Z'
updatedAt: '2026-05-06T01:43:57.260Z'
---

When inserting into any table whose Prisma model uses `@updatedAt` (e.g. `updatedAt DateTime @updatedAt @map("updated_at")`), raw SQL `INSERT` statements MUST set `updated_at = now()` explicitly. The DB column has NO `DEFAULT` — Prisma manages the field at the application layer only. Inserting via `prisma.$executeRawUnsafe` without it raises `Code 23502: not_null violation`.

`@default(now())` on `created_at` IS a real DB default and works in raw inserts. `@updatedAt` is NOT.

**Why:** caught during seed-enrollment-migration-test.ts authoring (task 3pcj45). Initial campus insert omitted `updated_at`; Prisma's auto-generated DDL for `@updatedAt` sets the column NOT NULL but has no default.

**How to apply:** when writing any raw-SQL seed/migration insert, include `created_at, updated_at` in the column list and pass `now(), now()` (or appropriate timestamps). Always check the model: any `@updatedAt`-decorated field needs explicit handling in raw SQL.
