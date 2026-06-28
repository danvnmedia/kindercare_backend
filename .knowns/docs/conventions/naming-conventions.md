---
title: Naming Conventions
description: File and code naming conventions across all layers
createdAt: '2026-01-03T19:51:50.625Z'
updatedAt: '2026-05-05T17:37:14.524Z'
tags:
  - conventions
  - naming
---

# Naming Conventions

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Controller | `{entity}.controller.ts` | `student.controller.ts` |
| Danger Controller (hard-delete) | `danger-{entity}.controller.ts` | `danger-student.controller.ts` |
| Use Case | `{action}-{entity}.use-case.ts` | `create-student.use-case.ts` |
| Repository Port | `{entity}.repository.ts` | `student.repository.ts` |
| Repository Implementation | `prisma-{entity}.repository.ts` | `prisma-student.repository.ts` |
| Mapper | `prisma-{entity}.mapper.ts` | `prisma-student.mapper.ts` |
| Request DTO | `{action}-{entity}.request.ts` | `create-student.request.ts` |
| Response DTO | `{entity}.response.ts` | `student.response.ts` |
| Domain Entity | `{entity}.entity.ts` | `student.entity.ts` |
| Entity Spec | `{entity}.entity.spec.ts` | `student.entity.spec.ts` |
| Enum | `{name}.enum.ts` | `gender.enum.ts`, `post-status.enum.ts` |
| Domain Exception | `{entity}-{error}.exception.ts` | `email-already-exists.exception.ts` |
| Guard | `{name}.guard.ts` | `clerk-auth.guard.ts`, `campus.guard.ts` |
| Decorator | `{name}.decorator.ts` | `current-user.decorator.ts`, `permissions.decorator.ts` |
| Validator | `is-{name}.validator.ts` | `is-e164-phone.validator.ts` |
| Transform | `transform-{name}.transformer.ts` | `transform-to-utc-date.transformer.ts` |
| Module | `{module}.module.ts` | `user-management.module.ts` |
| Service (port impl) | `{name}.service.ts` | `student-code-generator.service.ts` |
| Adapter (port impl) | `{provider}-{name}.adapter.ts` | `clerk-authentication.adapter.ts` |
| Transaction Ops | `{domain}.transaction-ops.ts` | `staff.transaction-ops.ts` |
| Cron Task | `{name}.task.ts` | `cleanup.task.ts` |
| Queue Processor | `{name}.processor.ts` | `email.processor.ts` |

> Note: there is no separate `value-object.ts` file convention because the codebase has no concrete value objects beyond the base class — see [@doc/patterns/value-object-pattern](patterns/value-object-pattern).

## Code Naming

| Type | Convention | Example |
|------|------------|---------|
| Class | PascalCase | `CreateStudentUseCase` |
| Interface | PascalCase | `StudentRepository`, `StudentProps` |
| Enum | PascalCase | `StudentStatus`, `PostTransitionAction` |
| Enum values | SCREAMING_SNAKE | `StudentStatus.ACTIVE`, `PostStatus.PENDING_REVIEW` |
| Method | camelCase | `findByEmailInCampus()` |
| Variable | camelCase | `campusId`, `clerkUid` |
| Constant | SCREAMING_SNAKE | `CAMPUS_ID_HEADER`, `MAX_POST_TITLE_LENGTH` |
| Private field | `_camelCase` (rare) or plain `camelCase` | `_id`, `cachedUser` |
| DI string token | UPPER_SNAKE_CASE | `"STUDENT_REPOSITORY"`, `"AUTHENTICATION_PORT"` |
| Permission ID | `module.action` | `"student.create"`, `"post.delete"` |
| Metadata key | camelCase | `"isPublic"`, `"requireCampusAccess"`, `"permissions"` |

## Folder Layout

```
src/
├── core/                     # framework-agnostic base + cross-cutting modules
│   ├── entities/             # Entity<Props>, UniqueEntityID
│   ├── value-objects/        # ValueObject<T> base
│   ├── types/                # Either, Optional
│   ├── validators/           # @IsE164Phone, @IsDateOfBirth, @TransformToUTCDate
│   └── modules/
│       └── standard-response/  # interceptor + paginated query support
│
├── domain/                   # pure TypeScript domain layer
│   ├── attendance/
│   ├── campus/
│   ├── class-management/
│   ├── content-management/
│   ├── file-management/
│   ├── rbac/
│   └── user-management/
│       ├── entities/
│       ├── enums/
│       ├── exceptions/
│       └── role.entity.ts
│
├── application/              # use cases + ports
│   ├── ports/                # cross-domain ports (Identity, UoW, Auth)
│   ├── attendance/
│   ├── campus/
│   ├── class-management/
│   ├── content-management/
│   ├── file-management/
│   ├── rbac/
│   └── user-management/
│       ├── ports/            # repository ports
│       └── use-cases/
│           └── {entity}/{action}-{entity}.use-case.ts
│
├── infra/                    # all framework-specific code
│   ├── http/
│   │   ├── controllers/
│   │   ├── decorators/
│   │   ├── dtos/
│   │   ├── guards/
│   │   ├── mappers/         # entity → response DTO mappers
│   │   ├── middleware/
│   │   ├── modules/
│   │   ├── context/         # RequestContext + campus-context utilities
│   │   └── http.module.ts
│   ├── persistence/
│   │   └── prisma/
│   │       ├── mapper/
│   │       ├── repositories/
│   │       ├── services/    # code generators
│   │       └── unit-of-work/
│   ├── external-services/
│   │   └── clerk/
│   ├── queue/
│   ├── cronjob/
│   └── storage/
│
├── test-utils/               # entity factories + mock repository factories
└── cli/                      # ts-node CLI entry points
```

## Conventions Within Files

1. **Imports order**: `@nestjs/*` → external libs (`@prisma/client`, `class-validator`) → internal (`@/...`) → relative (`./`, `../`).
2. **One class per file** unless the secondary class is a tightly coupled helper (e.g. `IsE164PhoneConstraint` next to `@IsE164Phone`).
3. **Static-only classes** (mappers, validators) are written as `export class XxxMapper { static toDomain... }`, never instantiated.
4. **Index re-exports**: each module exposes an `index.ts` at the use-case folder, the ports folder, and the entities folder. Direct file imports are also acceptable, but prefer the index in cross-module imports.
5. **`type` vs `interface`**: prefer `interface` for domain props and DTOs (extensible, declarative), `type` for unions / `Pick`/`Omit` derived types.

## Naming Pitfalls in This Codebase

| Avoid | Use instead |
|-------|-------------|
| `staffType` (string field) | `staffTypeId` (FK to `StaffType` table) |
| `User.role` | `User.roleAssignments[]` (with campus context) |
| `dateOfBirth: string` in domain | `dateOfBirth: Date \| null` |
| `gender: 'MALE' \| 'FEMALE'` | `gender: Gender \| null` (the enum) |
| Manually built `where: { campusId }` in use cases | Pass via `findByCampusId` / `findAll(params, { campusId })` scope |
