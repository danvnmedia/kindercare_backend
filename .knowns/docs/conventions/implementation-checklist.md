---
title: Implementation Checklist
description: Step-by-step checklist for adding a new entity or feature across all layers
createdAt: '2026-01-03T19:51:49.074Z'
updatedAt: '2026-05-31T02:18:13.985Z'
tags:
  - conventions
  - checklist
---

# Implementation Checklist

Use this when adding a new entity or feature. Check items in order because each layer depends on the one above.

## 1. Schema (`prisma/schema.prisma`)

- [ ] Add the model with `id String @id @default(uuid()) @db.Uuid`.
- [ ] Add `campusId String @map("campus_id") @db.Uuid` and the relation if the entity is campus-scoped. Most entities are campus-scoped; see @doc/architecture/multi-campus-architecture.
- [ ] Add `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)`.
- [ ] Add `updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)`.
- [ ] Decide soft-delete style: `isArchived Boolean` for recoverable archive or `isDeleted Boolean + deletedAt DateTime?` for audit trail. See @doc/architecture/audit-trail-soft-delete-patterns.
- [ ] Add composite uniqueness with `campusId`, for example `@@unique([campusId, name])`.
- [ ] Add `@@index([campusId])` and any per-status indexes you'll filter on.
- [ ] Use `onDelete: Restrict` on the campus relation; `Cascade` only for entities owned by the parent, such as `Attachment` cascading from `Post`.
- [ ] `npm run prisma:migrate:dev -- --name <description>`.
- [ ] For hand-written migrations, raw SQL, nullable unique keys, or active-only archive uniqueness, check @doc/patterns/prisma-migration-patterns.

## 2. Domain Layer (`src/domain/{module}/`)

- [ ] Create the entity at `entities/{entity}.entity.ts` extending `Entity<Props>`.
- [ ] Define `XxxProps` interface and `UpdateXxxData = Partial<Omit<XxxProps, immutables>>`.
- [ ] Implement getters for every prop.
- [ ] Implement domain methods such as `updateProfile`, `archive`, or `restore`; each mutating method calls `touch()`.
- [ ] Implement `static create(props, id?)` factory with invariant validation throwing plain `Error`.
- [ ] Add enums under `enums/` if any field uses one.
- [ ] Re-export from the module-level `index.ts`.
- [ ] Write a `*.entity.spec.ts` covering factory invariants and domain methods.

Domain code is framework-agnostic: no `@Injectable`, no Prisma types, no class-validator.

## 3. Application Layer (`src/application/{module}/`)

### Repository port

- [ ] Create `ports/{entity}.repository.ts` as an interface or abstract class.
- [ ] Standard methods: `findById`, `findAll(params, scope?)`, `save`, `update`, `delete`.
- [ ] Add campus-scoped lookups: `findByCampusId(campusId)`, `findByXxxInCampus(campusId, value)`.
- [ ] If your entity links to identities, add `findByUserId(userId)`.

### Use cases

- [ ] One file per operation under `use-cases/{entity}/{action}-{entity}.use-case.ts`.
- [ ] Define `XxxInput` interface with campus-scoped fields first.
- [ ] Inject repositories with `@Inject('XXX_REPOSITORY')`.
- [ ] Validate cross-campus references; every related entity must have the same `campusId`.
- [ ] Throw NestJS exceptions such as `BadRequestException`, `ConflictException`, `NotFoundException`, or `ForbiddenException`.
- [ ] Use `UnitOfWorkPort` for multi-table writes and audited mutations. See @doc/patterns/unit-of-work-pattern.
- [ ] Use the saga pattern when external services such as Clerk participate. See @doc/patterns/saga-pattern.
- [ ] Log entry, success, and failure with `Logger`.

## 4. Infrastructure Layer (`src/infra/`)

### Mapper (`persistence/prisma/mapper/`)

- [ ] `prisma-{entity}.mapper.ts` with five static methods: `toDomain`, `toDomainSimple`, `toPrisma`, `toPrismaUpdate`, `toDomainArray`.
- [ ] Use `Prisma.XxxUncheckedCreateInput` for `toPrisma`.
- [ ] Use `Prisma.XxxUncheckedUpdateInput` for `toPrismaUpdate` if any FK column is being updated. See @doc/patterns/mapper-pattern.
- [ ] Omit immutable fields such as `id`, `campusId`, generated codes, and `createdAt` from `toPrismaUpdate`.

### Repository implementation

- [ ] `persistence/prisma/repositories/prisma-{entity}.repository.ts` implementing the port.
- [ ] Use `PrismaQueryService.executeQuery(...)` for `findAll` with `allowedFilterFields` and `allowedSortFields`.
- [ ] Pass `scope: { campusId }` to enforce campus filtering at the system level, not through user-controllable filters.

### DTOs

- [ ] Request DTOs: `dtos/{module}/{action}-{entity}.request.ts` with `class-validator` decorators and `@ApiProperty`.
- [ ] Response DTOs: `dtos/{module}/{entity}.response.ts` with `@Expose()` on every field.
- [ ] Use custom validators where applicable: `@IsE164Phone`, `@IsDateOfBirth`, `@TransformToUTCDate`.

### Controller

- [ ] `controllers/{module}/{entity}.controller.ts` with `@Controller`, `@ApiTags`, `@ApiBearerAuth("JWT")`.
- [ ] `@UseGuards(ClerkAuthGuard)` at the class level.
- [ ] `@RequireCampusAccess()` on each route, which auto-applies `CampusGuard`.
- [ ] `@StandardResponse({ type: XxxResponse, isPaginated?, isArray? })` on each endpoint.
- [ ] `@CampusContext()` to extract campus, `@CurrentUser()` for the authenticated user.
- [ ] `@ApiHeader({ name: "x-campus-id", required: true })` documentation.
- [ ] Hard-deletes go in a separate `DangerXxxController`.

### Module

- [ ] Bind repository: `{ provide: 'XXX_REPOSITORY', useClass: PrismaXxxRepository }`.
- [ ] Register all use cases as providers.
- [ ] Register controllers.
- [ ] Import `RequestContextModule`, `CampusModule`, `PrismaModule`, `StandardResponseModule`, `ClerkModule` as needed.
- [ ] Export the repository token if other modules need it.

## 5. Cross-Cutting

### Authorization

- [ ] Add per-action permissions such as `{entity}.create`, `{entity}.read`, and `{entity}.update` to `SeedPermissionsUseCase` and re-seed.
- [ ] Apply `@Permissions(...)` plus `@UseGuards(PermissionsGuard)` to each route.
- [ ] Decide which roles get the new permissions and assign in seed/migration.

### Tests

- [ ] Use `src/test-utils/entity-factories.ts` to construct entities.
- [ ] Use `src/test-utils/mock-repository-factory.ts` to mock repositories.
- [ ] Add an integration spec for cross-campus prevention if the entity is campus-scoped. Use `application/campus/use-cases/campus-isolation.integration.spec.ts` as the pattern.

### Documentation

- [ ] Update @doc/guides/pagination-and-filtering with allowed sort/filter fields for new list endpoints.
- [ ] If you add a sequential code generator, follow @doc/guides/code-generation-pattern end to end.
- [ ] If the feature introduces reusable migration or projection behavior, update @doc/patterns/prisma-migration-patterns or @doc/patterns/read-projection-patterns.

## What NOT To Add

- Domain events / event handlers are not implemented. See @doc/patterns/domain-events-pattern.
- `DomainException` base class / global filter is not implemented. Use NestJS exceptions.
- `Email` / `PhoneNumber` value objects are not used. Validate in the DTO.
- `@SkipEmailVerification` does not exist. Email verification is not a guard concern in this codebase.
- JWT decoding in guards is not needed. Clerk/AuthMiddleware handle that.

## File Creation Cheat Sheet

Adding a new `Subject` entity, for instance, requires roughly these files:

```text
prisma/schema.prisma                                       (modified)
src/domain/class-management/entities/subject.entity.ts
src/domain/class-management/entities/subject.entity.spec.ts
src/application/class-management/ports/subject.repository.ts
src/application/class-management/use-cases/subject/{create,get-all,update,delete}-subject.use-case.ts
src/infra/persistence/prisma/mapper/prisma-subject.mapper.ts
src/infra/persistence/prisma/repositories/prisma-subject.repository.ts
src/infra/http/dtos/class-management/subject/{create,update}-subject.request.ts
src/infra/http/dtos/class-management/subject/subject.response.ts
src/infra/http/controllers/class-management/subject.controller.ts
src/infra/http/modules/class-management.module.ts          (modified to register)
```

Plus, if applicable, permission seeds and tests.

## Refactor Sequencing Note

When a spec removes a port method and also removes the only production consumer of that method, land those changes atomically. Do not implement the port contract removal first if it leaves the build broken until a later task.

Heuristic:

- If a port method has one production caller and that caller is being removed by the same spec, remove the method, caller use case, route, and DI provider in the same task.
- The later replacement task should become additive, such as adding the new use case and route.
- Surface the sequencing adjustment in the plan before implementation so the task history explains why the literal spec order was tightened.

This keeps each merged task buildable while preserving the intended final architecture.
