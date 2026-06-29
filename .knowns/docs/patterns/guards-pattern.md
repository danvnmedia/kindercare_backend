---
title: Guards Pattern
description: Authentication and authorization guards (Clerk, Campus, Roles, Permissions) and their interaction with RequestContext
createdAt: "2026-01-03T19:52:36.724Z"
updatedAt: "2026-06-29T00:38:04.898Z"
tags:
  - patterns
  - guards
  - security
  - authentication
  - authorization
  - rbac
  - campus
---

# Guards Pattern

> Authentication and authorization. Located at `src/infra/http/guards/`.

The application has **four guards** that compose into a layered security pipeline. Authentication itself is split between `AuthMiddleware` (token verification) and `ClerkAuthGuard` (presence check) — see [@doc/architecture/adr-hybrid-authentication-context-architecture](architecture/adr-hybrid-authentication-context-architecture) for the full architecture.

## Guard Inventory

| Guard              | Responsibility                                                  | Reads                                                             | DB calls                 |
| ------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| `ClerkAuthGuard`   | Reject if not authenticated (or `@Public`)                      | `requestContext.clerkId`                                          | 0                        |
| `CampusGuard`      | Validate campus exists, active, user-accessible                 | `X-Campus-Id` header / params / query, `requestContext.getUser()` | 1–2 (campus + lazy user) |
| `RolesGuard`       | Match `@Roles()` against user's role names in current campus    | `requestContext.getUser()` (cached)                               | 0                        |
| `PermissionsGuard` | Match `@Permissions()` against permission IDs from user's roles | `requestContext.getUser()` (cached)                               | 0                        |

The `RequestContext` request-scoped service provides a **single user fetch per request** that all guards share — see `src/infra/http/context/request-context.service.ts`.

## ClerkAuthGuard

`src/infra/http/guards/clerk-auth.guard.ts`

Pure presence check. Does not verify the token (the middleware already did). Honours `@Public()`.

```typescript
@UseGuards(ClerkAuthGuard)
@Get("profile")
async getProfile() { ... }

@Public()
@Get("health")
async health() { ... }
```

Throws `UnauthorizedException("Authentication required")` when `clerkId` is missing and the route is not `@Public`.

## CampusGuard

`src/infra/http/guards/campus.guard.ts`

Triggered by `@RequireCampusAccess(...)` (which `applyDecorators(SetMetadata, UseGuards(CampusGuard))`). Performs five checks in order:

1. Extract campus ID from `x-campus-id` header → route param `:campusId` → query `?campusId=` (in that priority).
2. Validate UUID v4 format.
3. `campusRepository.findById(campusId)` — throw 404 if missing.
4. Reject archived campuses unless `requireActive: false`.
5. Authorize the user:
   - If `allowGlobalAdmin: true` and the user has any global role with `isSystemRole = true`, bypass.
   - Otherwise call `hasCampusAccess(user, campusId)` which checks `user.getRolesForCampus(campusId)` is non-empty.

On success it stores the validated ID on both the request and `RequestContext`. Downstream guards and `@CampusContext()` read from there.

```typescript
@RequireCampusAccess()                                 // all defaults
@RequireCampusAccess({ required: false })              // optional campus
@RequireCampusAccess({ checkUserAccess: false })       // public per-campus info
@RequireCampusAccess({ requireActive: false })         // admin un-archive endpoints
@RequireCampusAccess({ allowGlobalAdmin: false })      // even system-roles are scoped here
```

## RolesGuard

`src/infra/http/guards/roles.guard.ts`

Reads `@Roles('Admin', 'Teacher')` metadata and checks the **role names** against the user's roles in the current campus context. Used for coarse-grained gates such as the post pin/unpin endpoints (`@Roles('Admin')`).

> Prefer `PermissionsGuard` for new endpoints — it scales better than role-name checks. Keep `RolesGuard` for endpoints where the policy really is "this exact role".

## PermissionsGuard

`src/infra/http/guards/permissions.guard.ts`

Reads `@Permissions('student.create', 'student.update')` and checks the **permission IDs** against the union of permissions from all roles applicable to the user in the current campus.

- Uses **OR** logic: any one of the listed permissions is enough.
- "Applicable roles" comes from `user.getRolesForCampus(campusId)` — that includes both globally assigned roles (`UserRole.campusId = null`) and campus-specific roles.
- Permission IDs follow the `module.action` convention (`student.read`, `post.delete`). See [@doc/architecture/multi-campus-architecture](architecture/multi-campus-architecture) for the catalogue.

## Composition and Execution Order

NestJS executes guards in the order they appear on the class first, then on the method. The conventional stack is:

```typescript
@Controller("students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)            // 1. authenticated?
export class StudentController {
  @Post()
  @RequireCampusAccess()                // 2. valid campus + user access (loads user)
  @UseGuards(PermissionsGuard)          // 3. permissions in that campus
  @Permissions("student.create")
  async create(...) { ... }
}
```

Total DB cost: `1 user fetch` (in `CampusGuard`) + `1 campus fetch`. Roles/Permissions reuse the cached user.

## Decorator → Guard Map

| Decorator                     | Guard that reads it                           | File                                            |
| ----------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `@Public()`                   | `ClerkAuthGuard`                              | `decorators/public.decorator.ts`                |
| `@RequireCampusAccess(opts)`  | `CampusGuard` (auto-applied)                  | `decorators/require-campus-access.decorator.ts` |
| `@OptionalCampusAccess(opts)` | `CampusGuard` with `required: false`          | same file                                       |
| `@Roles(...names)`            | `RolesGuard`                                  | `decorators/roles.decorator.ts`                 |
| `@Permissions(...ids)`        | `PermissionsGuard`                            | `decorators/permissions.decorator.ts`           |
| `@CurrentUser()`              | (param decorator — pulls from `request.user`) | `decorators/current-user.decorator.ts`          |
| `@CampusContext()`            | (param decorator — pulls validated ID)        | `decorators/campus.decorator.ts`                |

See [@doc/patterns/decorators-pattern](patterns/decorators-pattern) for full decorator usage.

## Module Wiring Requirements

Any module whose controllers use these guards must import `RequestContextModule` so the request-scoped `RequestContext` and `USER_REPOSITORY` are available:

```typescript
@Module({
  imports: [
    PrismaModule,
    ClerkModule,
    StandardResponseModule,
    RequestContextModule,   // <— required for guards
    CampusModule,           // <— provides CAMPUS_REPOSITORY for CampusGuard
  ],
  providers: [CampusGuard, RolesGuard, PermissionsGuard, ...],
})
```

`CampusGuard` is provided once per feature module; it injects `CAMPUS_REPOSITORY`. The other guards have no module-specific dependencies beyond `RequestContext`.

## Common Pitfalls

| Mistake                                                           | Why it breaks                                             | Fix                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Adding `@Permissions(...)` without `@UseGuards(PermissionsGuard)` | `PermissionsGuard` is opt-in per route                    | Add the guard or apply it on the controller                     |
| Reading `request.user` before `CampusGuard` runs                  | `CampusGuard` is what triggers the lazy user load         | Inject `RequestContext` and call `getUser()` directly           |
| Putting `@RequireCampusAccess()` on a global endpoint             | 400 every time the header is omitted                      | Use `@OptionalCampusAccess()`                                   |
| Naming a role "Super Admin" expecting bypass                      | Bypass is keyed off the `isSystemRole` flag, not the name | Mark the role `isSystemRole = true` via a seed/migration        |
| Importing only `ClerkModule` without `RequestContextModule`       | Guards fail to resolve `USER_REPOSITORY`                  | Always import `RequestContextModule` (transitively or directly) |

## Parent/Self-Service Relationship Access

Parent/self-service endpoints are authenticated user flows, not admin/staff RBAC flows. Use this pattern when a guardian needs to act in a selected campus but may not have a `UserRole` assignment for that campus.

For campus-scoped parent actions, validate the campus and hydrate the domain user, but skip RBAC campus-role membership:

```typescript
@Get("me/students")
@RequireCampusAccess({ checkUserAccess: false })
@UseGuards(HydrateCurrentUserGuard)
async getMyStudents(
  @CampusContext() campusId: string,
  @CurrentUser() currentUser: User,
) {
  return this.getCurrentGuardianStudentsUseCase.execute(campusId, currentUser);
}
```

This still requires authentication through the controller's `ClerkAuthGuard`. `CampusGuard` validates that the campus exists, is active unless explicitly configured otherwise, and stores the campus ID for `@CampusContext()`. `checkUserAccess: false` only bypasses the RBAC role-membership check; it does not grant permissions.

The use case must resolve the guardian profile from trusted server-side context, usually `guardianRepository.findByUserIdInCampus(currentUser.id.toString(), campusId)`. Do not accept or trust `userId` or `guardianId` from the client for self-service identity. After resolving the guardian, authorize the requested operation through relationship data such as `GuardianStudent` links in the same campus.

Parent relationship access must never grant admin/staff capabilities. Admin and staff routes continue to use normal `@RequireCampusAccess()`, `PermissionsGuard`, and explicit permission metadata. A mixed staff+guardian user should receive admin access only through RBAC routes and parent access only through guardian relationship checks.

Campus discovery is the exception because there is no selected campus yet. `GET /guardians/me/campuses` uses `HydrateCurrentUserGuard` and resolves non-archived campuses from active guardian profiles for `currentUser.id`; it does not accept `userId`, `guardianId`, or `campusId` input.
