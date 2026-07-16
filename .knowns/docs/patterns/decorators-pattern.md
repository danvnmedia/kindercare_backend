---
title: Decorators Pattern
description: 'Custom HTTP decorators: Public, Roles, Permissions, RequireCampusAccess, CampusContext, CurrentUser'
createdAt: '2026-01-03T19:52:38.347Z'
updatedAt: '2026-07-14T17:43:23.777Z'
tags:
  - patterns
  - decorators
  - http
  - rbac
  - campus
---

# Decorators Pattern

> Custom HTTP decorators. Located at `src/infra/http/decorators/`.

The decorators split into two categories:

- **Metadata decorators** that store values on the route handler/class for guards to read (`@Public`, `@Roles`, `@Permissions`, `@RequireCampusAccess`).
- **Parameter decorators** that pull validated context out of the request (`@CurrentUser`, `@CampusContext`).

## Metadata Decorators

### `@Public()`

`decorators/public.decorator.ts`

Marks an endpoint or controller as public. `ClerkAuthGuard` skips authentication when this metadata is present.

```typescript
@Public()
@Get("health")
async health() { return { status: "ok" }; }
```

Metadata key: `IS_PUBLIC_KEY = "isPublic"`.

### `@Roles(...names)`

`decorators/roles.decorator.ts`

Coarse-grained role gate. Used by `RolesGuard` to match against the names of roles the user holds in the current campus context.

```typescript
@UseGuards(RolesGuard)
@Roles("Admin")
@Post(":id/pin")
async pinPost() { ... }
```

Metadata key: `ROLES_KEY = "roles"`. **Important**: `RolesGuard` must be explicitly added with `@UseGuards`; the `@Roles` decorator alone does not activate it.

### `@Permissions(...ids)`

`decorators/permissions.decorator.ts`

Fine-grained permission gate. Used by `PermissionsGuard`. Takes permission IDs in the `module.action` format and uses **OR** logic — the user needs at least one.

```typescript
@UseGuards(PermissionsGuard)
@Permissions("student.create", "student.update")
@Post()
async create() { ... }
```

Metadata key: `PERMISSIONS_KEY = "permissions"`. The full permission catalogue lives in `SeedPermissionsUseCase` (`src/application/rbac/use-cases/seed-permissions.use-case.ts`).

### `@RequireCampusAccess(options)` and `@OptionalCampusAccess(options)`

`decorators/require-campus-access.decorator.ts`

A composite decorator (`applyDecorators(SetMetadata, UseGuards(CampusGuard))`) that both attaches options metadata and applies `CampusGuard`. Use this — never apply `CampusGuard` manually with `@UseGuards`.

```typescript
@RequireCampusAccess()                                 // all defaults: required, active, user-access, admin-bypass
@RequireCampusAccess({ required: false })              // header is optional
@RequireCampusAccess({ checkUserAccess: false })       // public per-campus info (e.g. campus name lookup)
@RequireCampusAccess({ requireActive: false })         // admin un-archive endpoints
@OptionalCampusAccess()                                 // alias for { required: false }
```

Options:

| Option | Default | Effect |
|--------|---------|--------|
| `required` | `true` | Throw 400 when no campus ID is provided |
| `requireActive` | `true` | Throw 403 when the campus is archived |
| `checkUserAccess` | `true` | Verify the authenticated user has any role in the campus |
| `allowGlobalAdmin` | `true` | Users with a global `isSystemRole` bypass the access check |

Metadata key: `REQUIRE_CAMPUS_ACCESS_KEY = "requireCampusAccess"`.

## Parameter Decorators

### `@CurrentUser()`

`decorators/current-user.decorator.ts`

Returns whatever `request.user` is — typed as `UserPayload`. The `User` domain entity gets attached by `RequestContext.getUser()` (which `CampusGuard` triggers); on routes that don't run `CampusGuard`, you must inject `RequestContext` and call `getUserOrFail()` instead.

```typescript
@Get("profile")
@UseGuards(ClerkAuthGuard)
async getProfile(@CurrentUser() user: User) { ... }
```

> There is also a `UserDecorator` exported as `@User()` in the same folder, but `@CurrentUser()` is the conventional one. Don't introduce both — pick one for your endpoint.

### `@CampusContext()`

`decorators/campus.decorator.ts`

Returns the campus ID after `CampusGuard` has validated it. Falls back to extracting from header/params/query if the guard hasn't run, but you should always pair this with `@RequireCampusAccess()` so the guard runs first.

```typescript
@Get(":id")
@RequireCampusAccess()
async findOne(
  @CampusContext() campusId: string,
  @Param("id", ParseUUIDPipe) id: string,
) { ... }
```

Always type as `string` when paired with `@RequireCampusAccess()` (default `required: true`), or `string | null` for `@OptionalCampusAccess()`.

The header constant is exported as `CAMPUS_ID_HEADER = "x-campus-id"`.

## Composition Examples

```typescript
@Controller("students")
@ApiTags("Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class StudentController {
  // Auth + campus + permission gate
  @Post()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student.create")
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateStudentRequest,
  ) { ... }

  // Auth + role gate (no campus)
  @Get("/system/health")
  @UseGuards(RolesGuard)
  @Roles("Admin")
  async health() { ... }

  // Public — no auth at all
  @Public()
  @Get("/public/info")
  async info() { ... }
}
```

## Best Practices

1. **Pair metadata with the right guard.** `@Roles` needs `RolesGuard`; `@Permissions` needs `PermissionsGuard`. The metadata alone is silent (the route is unprotected). The exception is `@RequireCampusAccess`, which auto-applies `CampusGuard`.
2. **Prefer `@Permissions` over `@Roles`.** Permissions are stable identifiers; role names drift.
3. **Don't mix `@CurrentUser` and `@User`.** Both exist for legacy reasons. New code should use `@CurrentUser`.
4. **Document the campus header.** When using `@RequireCampusAccess()`, add `@ApiHeader({ name: "x-campus-id", required: true })` to your Swagger annotations.
5. **Don't read `campusId` from the body.** The body is user-controlled. The `@CampusContext()` value is validated and can be trusted; pass it to use cases as a separate argument or override the body field.

### `@RequireAllPermissions(...ids)`

`decorators/require-all-permissions.decorator.ts`

Declares a conjunctive permission policy for the dedicated `AllPermissionsGuard`. Use it only when a route must require every permission, and pair it with `@UseGuards(AllPermissionsGuard)`.

```typescript
@Get("medication-summary")
@RequireCampusAccess()
@UseGuards(AllPermissionsGuard)
@RequireAllPermissions(
  "medication_request.read",
  "medication_administration.read",
)
async getSummary() { /* ... */ }
```

Do not pass multiple IDs to `@Permissions` when AND semantics are required; that decorator deliberately retains OR semantics.
