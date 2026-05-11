---
title: Module Pattern
description: 'NestJS feature module structure: imports, controllers, providers, repository token bindings, port → adapter mapping, RequestContextModule requirement, forwardRef'
createdAt: '2026-01-03T19:52:19.858Z'
updatedAt: '2026-05-05T17:35:53.216Z'
tags:
  - patterns
  - module
  - nestjs
  - di
---

# Module Pattern

> NestJS feature modules. Located at `src/infra/http/modules/{module}.module.ts`.

A feature module wires controllers to use cases to repositories, declares the DI tokens, and pulls in shared infrastructure modules. The shape is consistent across the codebase — see `user-management.module.ts`, `content-management.module.ts`, `attendance.module.ts` for canonical examples.

## Anatomy

```typescript
@Module({
  imports: [
    PrismaModule,           // database access
    ClerkModule,            // identity + AUTHENTICATION_PORT
    StandardResponseModule, // PrismaQueryService for paginated lists
    RequestContextModule,   // request-scoped user context (required for guards)
    CampusModule,           // CAMPUS_REPOSITORY for CampusGuard
    forwardRef(() => StaffTypeModule),     // circular dep resolution
  ],
  controllers: [
    StudentController,
    GuardianController,
    DangerStudentController,    // hard-delete admin endpoints
  ],
  providers: [
    // Use cases
    CreateStudentUseCase,
    GetAllStudentsUseCase,
    UpdateStudentUseCase,

    // Port → Adapter (abstract class binding)
    { provide: StudentCodeGeneratorPort, useClass: StudentCodeGeneratorService },

    // Repository tokens (string-based binding)
    { provide: "STUDENT_REPOSITORY", useClass: PrismaStudentRepository },
    { provide: "GUARDIAN_REPOSITORY", useClass: PrismaGuardianRepository },

    // Guards (provided so they can be injected by route decorators)
    CampusGuard,
    RolesGuard,
    PermissionsGuard,
  ],
  exports: [
    "STUDENT_REPOSITORY",
    "GUARDIAN_REPOSITORY",
  ],
})
export class UserManagementModule {}
```

## DI Binding Styles

The codebase uses **three** binding styles. Use them consistently per type.

### 1. String token → repository implementation

For repositories. The token is the uppercase, snake-cased entity name + `_REPOSITORY`. Inject with `@Inject('XXX_REPOSITORY')`.

```typescript
{ provide: "STUDENT_REPOSITORY", useClass: PrismaStudentRepository }

@Injectable()
export class CreateStudentUseCase {
  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}
}
```

### 2. Abstract class → service implementation

For ports that aren't repositories (`IdentityPort`, `UnitOfWorkPort`, `StudentCodeGeneratorPort`). The abstract class itself is the token — no `@Inject` needed.

```typescript
{ provide: StudentCodeGeneratorPort, useClass: StudentCodeGeneratorService }

@Injectable()
export class CreateStudentUseCase {
  constructor(
    private readonly studentCodeGenerator: StudentCodeGeneratorPort,  // no @Inject
  ) {}
}
```

### 3. Concrete class

For NestJS-native services with no abstraction (use cases, NestJS-provided things like `Reflector`).

```typescript
providers: [CreateStudentUseCase]

constructor(private readonly createStudentUseCase: CreateStudentUseCase) {}
```

## Module Inventory

| Module | Provides | Imported by |
|--------|----------|-------------|
| `AppModule` | Composition root | (none) |
| `HttpModule` | Aggregates feature modules, applies `AuthMiddleware` | `AppModule` |
| `PrismaModule` | `PrismaService`, `PrismaUnitOfWork → UnitOfWorkPort` | All feature modules |
| `ClerkModule` | `IdentityPort`, `AUTHENTICATION_PORT`, `ClerkClient` | Modules that touch identities or auth |
| `StandardResponseModule` | `StandardResponseInterceptor`, `PrismaQueryService`, `QueryValidatorService` | Modules with paginated lists |
| `RequestContextModule` | `RequestContext` (request-scoped), `USER_REPOSITORY` | Any module with guards |
| `CampusModule` | `CAMPUS_REPOSITORY`, campus use cases | Modules using `CampusGuard` |
| `RbacModule` | `PERMISSION_REPOSITORY`, RBAC use cases | `UserManagementModule` |
| `StorageModule` | `StorageService` (file storage abstraction) | `FileManagementModule` |
| `QueueModule` | `QueueService`, BullMQ wiring | `AppModule` |
| `CronjobModule` | Scheduled tasks via `@Cron` | `AppModule` |

## Guards Need `RequestContextModule`

Any feature module whose controllers use `ClerkAuthGuard`, `CampusGuard`, `RolesGuard`, or `PermissionsGuard` **must import `RequestContextModule`** (directly or transitively). The module exports the request-scoped `RequestContext` and `USER_REPOSITORY` that all four guards rely on.

```typescript
imports: [RequestContextModule, /* … */]
```

If you forget this, the guard fails to instantiate at runtime with a "RequestContext provider not found" error.

## Circular Dependencies — `forwardRef`

When two feature modules need to import each other (e.g. `UserManagementModule` ↔ `StaffTypeModule`), wrap the import in `forwardRef`:

```typescript
imports: [
  forwardRef(() => StaffTypeModule),
  forwardRef(() => GuardianRelationshipTypeModule),
],
```

Pair it on **both sides**. The pattern signals a design smell — consider whether the dependency direction is right — but it's accepted when the modules genuinely cross-reference repositories.

## Re-Exporting Repositories

If another module needs your repositories, **add them to your `exports`** array:

```typescript
exports: [
  "USER_REPOSITORY",
  "ROLE_REPOSITORY",
  "STUDENT_REPOSITORY",
  "GUARDIAN_REPOSITORY",
  "STAFF_REPOSITORY",
],
```

The downstream module can then import yours and inject the token. Don't re-bind the same repository in two modules — pick one owner.

## Composition Tips

1. **One module per bounded context** (`UserManagementModule`, `ContentManagementModule`, `AttendanceModule`). Don't split per-entity.
2. **Controllers grouped by entity inside the module.** A module can host many controllers (`StudentController`, `GuardianController`, `StaffController`, etc.).
3. **Danger endpoints in their own controller.** Hard-delete operations live in `DangerXxxController` separately so permission policies can target them.
4. **Use cases are providers, not exports.** Other modules call your controllers, not your use cases.
5. **Repositories are exports.** Other modules' use cases may need to read your aggregates.

## Reference

| File | Why look at it |
|------|----------------|
| `src/app.module.ts` | Composition root |
| `src/infra/http/http.module.ts` | Middleware wiring (`AuthMiddleware`), feature module aggregation |
| `src/infra/http/modules/user-management.module.ts` | Largest module — full DI shape, `forwardRef` example |
| `src/infra/http/modules/content-management.module.ts` | Many use cases, multiple repository bindings |
| `src/infra/persistence/prisma/prisma.module.ts` | Provides `UnitOfWorkPort` |
| `src/infra/external-services/clerk/clerk.module.ts` | Port + adapter binding example |
