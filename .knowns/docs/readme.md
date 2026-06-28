---
title: README
description: Documentation index — start here. Map of every doc with one-line summaries grouped by topic.
createdAt: '2026-01-03T19:51:45.975Z'
updatedAt: '2026-06-25T16:35:23.768Z'
tags:
  - index
  - overview
  - readme
---

# Kindercare Backend — Documentation

> Code Standards & Patterns for the Kindercare multi-campus school management API. Built on NestJS + Prisma + Clerk, structured along Clean Architecture lines.

**New here?** Read @doc/architecture/clean-architecture-overview first. It's the map; everything else is territory.

---

## Layout

| Layer | Location | Purpose |
|-------|----------|---------|
| Domain | `src/domain/` | Pure TS entities, enums, exceptions — no framework |
| Application | `src/application/` | Use cases + ports (interfaces) |
| Infrastructure | `src/infra/` | HTTP, persistence, external services, queues, cron |
| Core | `src/core/` | Cross-cutting primitives: `Entity<Props>`, `ValueObject<T>`, validators, StandardResponse module |

---

## Architecture

| Doc | What it covers |
|-----|----------------|
| @doc/architecture/clean-architecture-overview | The big picture — layers, dependency rule, request flow, module composition |
| @doc/architecture/multi-campus-architecture | Federated multi-campus model — campus-scoped entities, isolation, immutable campus IDs |
| @doc/architecture/adr-hybrid-authentication-context-architecture | Why we use middleware + request-scoped context for auth (single DB fetch per request) |
| @doc/architecture/module-and-request-flow | Module hierarchy + step-by-step request lifecycle |
| @doc/architecture/rbac-system | Permissions, roles, UserRole assignments, system-role bypass |
| @doc/architecture/identity-and-clerk-integration | Clerk port + adapter, identity lifecycle |
| @doc/architecture/content-management-system | Post lifecycle, approval workflow, audiences, comments, reactions, pinning |
| @doc/architecture/attendance-system | Master-detail (summary + logs) attendance tracking |
| @doc/architecture/file-management-and-storage | Two-phase signed-URL upload, storage abstraction, attachments |
| @doc/architecture/audit-trail-soft-delete-patterns | isArchived vs isDeleted+deletedAt, history tables, audit user fields |
| @doc/architecture/queue-and-cronjob | BullMQ queues + NestJS Cron scheduled tasks |

---

## Patterns

| Doc | What it covers |
|-----|----------------|
| @doc/patterns/entity-pattern | Entity<Props> and Style B (interface + service) — invariants, factories, lifecycle |
| @doc/patterns/value-object-pattern | ValueObject<T> base + when (rarely) to add a concrete VO |
| @doc/patterns/use-case-pattern | Application-layer business operations, campus context, validation order |
| @doc/patterns/repository-pattern | Port + Prisma implementation, campus-scoped queries, scope trust boundary |
| @doc/patterns/mapper-pattern | Prisma to Domain conversion, the UncheckedUpdateInput footgun for FKs |
| @doc/patterns/unit-of-work-pattern | UnitOfWorkPort + modular TransactionContext for atomic multi-table writes |
| @doc/patterns/saga-pattern | Compensating transactions for Clerk + DB orchestration |
| @doc/patterns/module-pattern | NestJS module structure, DI binding styles, forwardRef, RequestContextModule requirement |
| @doc/patterns/controller-pattern | HTTP routing, guards composition, Swagger annotations, danger controllers |
| @doc/patterns/dto-pattern | Request DTOs (class-validator) + Response DTOs (class-transformer + Expose) |
| @doc/patterns/standard-response-pattern | The interceptor that wraps responses + auto-converts entities to DTOs |
| @doc/patterns/guards-pattern | ClerkAuthGuard, CampusGuard, RolesGuard, PermissionsGuard and how they compose |
| @doc/patterns/decorators-pattern | Custom decorators: Public, Roles, Permissions, RequireCampusAccess, CampusContext, CurrentUser |
| @doc/patterns/exception-pattern | Error handling — NestJS exceptions in app layer, plain Error in domain |
| @doc/patterns/validation-pattern | Custom validators: IsE164Phone, IsDateOfBirth, TransformToUTCDate |
| @doc/patterns/testing-pattern | Unit + integration tests, test-utils factories and mocks |
| @doc/patterns/domain-events-pattern | (Not implemented) — saga + queue cover today's needs |
| @doc/patterns/event-handler-pattern | (Not implemented) — see queue/cron docs for async work |

---

## Guides

| Doc | What it covers |
|-----|----------------|
| @doc/guides/backend-dev-deployment | Developer deployment and first-run setup: env, Docker, Prisma migrations, seeds, Clerk, and admin bootstrap |
| @doc/guides/working-with-campuses | Practical patterns for campus-aware features |
| @doc/guides/pagination-and-filtering | Query operators, sort grammar, allowed-fields per endpoint |
| @doc/guides/code-generation-pattern | Sequential codes (Student, Staff) — atomic counter tables, immutability across four layers |

---
## Conventions

| Doc | What it covers |
|-----|----------------|
| @doc/conventions/implementation-checklist | Step-by-step checklist for adding a new entity end-to-end |
| @doc/conventions/naming-conventions | File and code naming across all layers |

---

## Specs and PRDs

General docs should not link to SDD specs or task records. When spec-derived behavior becomes durable, write the actual rule into the relevant architecture, pattern, guide, or handoff doc.

| Doc | What it covers |
|-----|----------------|
| @doc/prds/post-and-content-management | Original PRD for Post CMS - Facebook-style posts, approval workflow |
| @doc/prds/frontend-multi-campus-migration-guide | Frontend guide for adopting the multi-campus headers and types |

---

## Reading Order for New Contributors

1. @doc/architecture/clean-architecture-overview — orient yourself
2. @doc/architecture/multi-campus-architecture — understand the most pervasive constraint
3. @doc/conventions/implementation-checklist — the recipe for adding anything
4. @doc/patterns/entity-pattern then @doc/patterns/use-case-pattern then @doc/patterns/controller-pattern — vertical slice
5. Pick a feature module that matches the area you'll be working in:
   - User management — @doc/architecture/identity-and-clerk-integration, @doc/patterns/saga-pattern
   - Posts and comments — @doc/architecture/content-management-system
   - Attendance — @doc/architecture/attendance-system
   - File handling — @doc/architecture/file-management-and-storage

---

## Tooling

- **Prisma**: schema at `prisma/schema.prisma`. Run `npm run prisma:migrate:dev -- --name <description>` to add a migration.
- **NestJS CLI**: `npm run start:dev` for hot reload.
- **Tests**: `npm run test`, `npm run test:watch`, `npm run test:cov`.
- **Swagger UI**: `http://localhost:3000/docs` once the server is running.
- **Admin CLI**: `npm run cli:create-admin`, `npm run cli:list-admins`, `npm run cli:delete-admin`.
- **Seeds**: `npx prisma db seed` runs `prisma/seed.ts`. Student fixture data via `npm run seed:students`.
