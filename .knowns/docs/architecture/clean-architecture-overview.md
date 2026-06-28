---
title: Clean Architecture Overview
description: High-level layer breakdown, dependency rules, request lifecycle, and how the existing patterns compose into a coherent application
createdAt: '2026-05-05T17:52:55.606Z'
updatedAt: '2026-05-05T17:52:55.606Z'
tags:
  - architecture
  - overview
  - clean-architecture
  - layers
  - dependency-rule
---

# Clean Architecture Overview

> The 30,000-ft view. New contributors should read this first, then drill into the pattern docs as needed.

The codebase follows a four-layer Clean Architecture, with a strict **inward dependency rule**: outer layers depend on inner layers, never the reverse.

```
┌────────────────────────────────────────────────────────────────────┐
│                       INFRASTRUCTURE                               │
│  src/infra/                                                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ HTTP — controllers, guards, interceptors, DTOs, middleware   │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ Persistence — Prisma repositories, mappers, UoW              │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ External — Clerk, storage, queue (BullMQ), cron              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ▲                                     │
│                              │ implements ports                    │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────────────┐
│                       APPLICATION                                  │
│  src/application/                                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Use Cases — business operations, transaction boundaries      │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │ Ports — Repository, IdentityPort, UnitOfWorkPort, Storage    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ▲                                     │
│                              │ depends on                          │
└──────────────────────────────┼─────────────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────────────┐
│                          DOMAIN                                    │
│  src/domain/                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Entities — pure TS, no NestJS, no Prisma                      │  │
│  │ Enums, exceptions                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                            CORE                                    │
│  src/core/                                                         │
│  Cross-cutting: Entity<Props>, ValueObject<T>, validators,         │
│  StandardResponse module                                           │
└────────────────────────────────────────────────────────────────────┘
```

`src/core` sits beside the layers — it provides framework-agnostic primitives that any layer may depend on (e.g. `Entity`, `Either`, custom validators). It is itself agnostic of NestJS in everything except `core/modules/standard-response/`, which is intentionally infrastructure-y but factored out for reuse.

## Dependency Rule

```
HTTP        → Application → Domain
Persistence → Application → Domain
External    → Application → Domain
```

| Allowed | Forbidden |
|---------|-----------|
| Use case imports a repository **port** | Use case imports `prisma-...repository.ts` |
| Use case imports a domain entity | Domain entity imports a use case |
| Mapper imports the domain entity | Domain entity imports a Prisma type |
| DTO imports a domain enum | Domain entity imports a class-validator decorator |
| Controller imports a use case | Domain or use case imports `@nestjs/common` HTTP exceptions (allowed in app layer for ergonomic reasons; domain throws plain `Error`) |

The TypeScript paths (`@/domain/...`, `@/application/...`, `@/infra/...`) make accidental crossings easy to spot in code review.

## Layer-by-Layer Responsibilities

### Domain (`src/domain/`)

- Pure TypeScript: no `@Injectable`, no Prisma, no class-validator.
- Defines entities (`Entity<Props>` subclass or plain interface — see [@doc/patterns/entity-pattern](patterns/entity-pattern)).
- Defines enums (`Gender`, `StudentStatus`, `PostStatus`, `AttendanceStatus`).
- Defines a small set of exceptions (mostly `extends Error`) for typed signals.
- Encapsulates invariants in factory methods (`Student.create()` throws on bad input).
- Encapsulates lifecycle in named methods (`student.archive()`, `post.submitForReview()`).

### Application (`src/application/`)

- Defines **ports** (interfaces / abstract classes) the infrastructure must satisfy.
  - Repository ports per entity.
  - Cross-domain ports: `IdentityPort`, `UnitOfWorkPort`, `AuthenticationPort`, `StorageService`, `StudentCodeGeneratorPort`, `StaffCodeGeneratorPort`.
- Defines **use cases** — one class per business operation.
- Orchestrates: validates input, loads entities, calls domain methods, persists, returns.
- Throws NestJS HTTP exceptions for use-case-level failures.
- Uses the **Unit of Work** for atomic multi-table writes ([@doc/patterns/unit-of-work-pattern](patterns/unit-of-work-pattern)).
- Uses the **Saga pattern** for Clerk + DB orchestration ([@doc/patterns/saga-pattern](patterns/saga-pattern)).

### Infrastructure (`src/infra/`)

- HTTP — controllers, guards, decorators, DTOs, middleware, request-scoped context. See [@doc/patterns/controller-pattern](patterns/controller-pattern), [@doc/patterns/guards-pattern](patterns/guards-pattern), [@doc/patterns/decorators-pattern](patterns/decorators-pattern), [@doc/patterns/dto-pattern](patterns/dto-pattern), [@doc/patterns/standard-response-pattern](patterns/standard-response-pattern).
- Persistence — Prisma repositories, mappers, services (code generators), Unit of Work implementation. See [@doc/patterns/repository-pattern](patterns/repository-pattern), [@doc/patterns/mapper-pattern](patterns/mapper-pattern).
- External services — Clerk adapter, storage adapter, queue, cron. See [@doc/architecture/identity-and-clerk-integration](architecture/identity-and-clerk-integration), [@doc/architecture/file-management-and-storage](architecture/file-management-and-storage), [@doc/architecture/queue-and-cronjob](architecture/queue-and-cronjob).

### Core (`src/core/`)

- `Entity<Props>`, `UniqueEntityID`, `ValueObject<T>` base classes.
- `Either<L, R>` and `Optional<T, K>` types.
- Custom `class-validator` decorators (`@IsE164Phone`, `@IsDateOfBirth`, `@TransformToUTCDate`).
- The `StandardResponse` module (interceptor, decorators, query service).

## End-to-End Request Flow

A typical campus-scoped, permission-gated POST:

```
1. main.ts starts NestFactory.create(AppModule), sets ValidationPipe + StandardResponseInterceptor globally.
2. AuthMiddleware verifies the Clerk token, sets request.clerkId. (See ADR-hybrid-authentication-context-architecture)
3. ClerkAuthGuard ensures clerkId is present.
4. CampusGuard:
   - Reads X-Campus-Id header.
   - Loads RequestContext.getUser() — single DB fetch for the whole request.
   - Validates campus + user access.
   - Sets RequestContext.campusId.
5. PermissionsGuard:
   - Reads cached user from RequestContext.
   - Computes union of permissions across roles applicable in this campus.
   - Allows iff @Permissions intersect.
6. ValidationPipe runs against the @Body() DTO (class-validator + class-transformer).
7. Controller method receives @CampusContext, @CurrentUser, @Body, delegates to a use case.
8. Use case:
   - Validates cross-entity campus consistency.
   - Calls domain entity factories.
   - For multi-table writes, opens unitOfWork.run.
   - For Clerk-touching writes, uses the saga pattern.
   - Returns the domain entity.
9. StandardResponseInterceptor:
   - Walks the entity, calls toPlain on ValueObjects, flattens Entity props.
   - Runs class-transformer with the @Expose-d Response DTO type.
   - Wraps in { success, message, data, pagination?, timestamp }.
10. Express ships the JSON response.
```

For diagrams, see [@doc/architecture/module-and-request-flow](architecture/module-and-request-flow).

## Cross-Cutting Concerns

| Concern | Doc |
|---------|-----|
| Multi-campus isolation | [@doc/architecture/multi-campus-architecture](architecture/multi-campus-architecture), [@doc/guides/working-with-campuses](guides/working-with-campuses) |
| RBAC | [@doc/architecture/rbac-system](architecture/rbac-system) |
| Authentication context | [@doc/architecture/adr-hybrid-authentication-context-architecture](architecture/adr-hybrid-authentication-context-architecture) |
| Audit + soft delete | [@doc/architecture/audit-trail-soft-delete-patterns](architecture/audit-trail-soft-delete-patterns) |
| Pagination + filtering | [@doc/guides/pagination-and-filtering](guides/pagination-and-filtering) |
| Sequential codes (Student/Staff) | [@doc/guides/code-generation-pattern](guides/code-generation-pattern) |
| Background jobs / cron | [@doc/architecture/queue-and-cronjob](architecture/queue-and-cronjob) |

## Module Composition

```
AppModule
├── ConfigModule.forRoot({ isGlobal: true })
├── StandardResponseModule          # global interceptor, query services
├── HttpModule
│   ├── ClerkModule                 # AUTHENTICATION_PORT, IdentityPort
│   ├── AuthModule                  # /auth/me
│   ├── CampusModule                # CAMPUS_REPOSITORY (used by CampusGuard everywhere)
│   ├── RbacModule                  # PERMISSION_REPOSITORY, permission CRUD
│   ├── UserManagementModule        # User, Role, Student, Guardian, Staff (largest module)
│   ├── StaffTypeModule
│   ├── GuardianRelationshipTypeModule
│   ├── ClassManagementModule       # Class, GradeLevel, SchoolYear, Subject, Enrollment
│   ├── ContentManagementModule     # Posts, comments, reactions, categories, settings
│   ├── FileManagementModule        # File upload + attachments
│   └── AttendanceModule            # Daily attendance summaries + logs
├── QueueModule                     # BullMQ
└── CronjobModule                   # Scheduled tasks
```

`HttpModule` applies `AuthMiddleware` globally via `consumer.apply(AuthMiddleware).forRoutes('*')`.

## Adding a New Feature — the Mental Map

1. Read the [@doc/conventions/implementation-checklist](conventions/implementation-checklist).
2. Decide the **bounded context** — does it fit in an existing module or warrant a new one?
3. Schema first: design the Prisma model with campus scoping if needed (see [@doc/architecture/multi-campus-architecture](architecture/multi-campus-architecture)).
4. Domain entity + invariants ([@doc/patterns/entity-pattern](patterns/entity-pattern)).
5. Repository port + Prisma implementation ([@doc/patterns/repository-pattern](patterns/repository-pattern), [@doc/patterns/mapper-pattern](patterns/mapper-pattern)).
6. Use cases ([@doc/patterns/use-case-pattern](patterns/use-case-pattern)). Use UoW + saga where appropriate.
7. DTOs + controller ([@doc/patterns/dto-pattern](patterns/dto-pattern), [@doc/patterns/controller-pattern](patterns/controller-pattern)).
8. Module wiring ([@doc/patterns/module-pattern](patterns/module-pattern)).
9. Permissions + tests ([@doc/architecture/rbac-system](architecture/rbac-system), [@doc/patterns/testing-pattern](patterns/testing-pattern)).

## What Makes This Codebase Different from a Generic NestJS Boilerplate

| Aspect | This codebase |
|--------|---------------|
| Auth | Clerk via port + adapter (replaceable) |
| Authorization | Two-axis: campus scope + permission |
| Multi-tenancy | Federated multi-campus with system-role bypass |
| Transactions | UnitOfWorkPort with modular per-domain transaction ops |
| External services | Saga pattern with explicit compensation |
| Response shape | Uniform via interceptor; entity → DTO automatic |
| Pagination | `PrismaQueryService` + scope-based filter trust boundary |
| Soft delete | Two styles (`isArchived` vs `isDeleted`+`deletedAt`) chosen per entity |
| Identity | `User` is global; profiles (`Guardian`, `Staff`) are campus-scoped |
| Domain events | Not implemented — direct calls + queue suffice today |
| Hard delete | Quarantined to `DangerXxxController` |

## When Things Go Wrong

| Symptom | Likely cause | Look at |
|---------|--------------|---------|
| 401 even when token is valid | `AuthMiddleware` failed silently or `RequestContextModule` not imported | [@doc/architecture/adr-hybrid-authentication-context-architecture](architecture/adr-hybrid-authentication-context-architecture) |
| 403 on a campus the user owns | User missing role in that campus, or `isSystemRole` not set | [@doc/architecture/rbac-system](architecture/rbac-system) |
| `where` filter ignored at runtime | Updating FK without `UncheckedUpdateInput` | [@doc/patterns/mapper-pattern](patterns/mapper-pattern) |
| Cross-campus data leaks | Use case skipped campus check, or `campusId` in `allowedFilterFields` | [@doc/guides/working-with-campuses](guides/working-with-campuses) |
| Clerk user orphaned after a failed creation | Saga compensation didn't run | [@doc/patterns/saga-pattern](patterns/saga-pattern) |
| Response is missing fields | Forgot `@Expose()` | [@doc/patterns/dto-pattern](patterns/dto-pattern) |

## Reference

This doc is a map; each linked sub-doc is the territory.
