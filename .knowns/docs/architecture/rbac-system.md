---
title: RBAC System
description: Permissions, Roles, UserRole assignments with campus scoping, system-role bypass, and StaffType default-role auto-assignment
createdAt: '2026-05-05T17:46:08.624Z'
updatedAt: '2026-05-05T17:46:08.624Z'
tags:
  - architecture
  - rbac
  - authorization
  - permissions
  - roles
  - multi-campus
---

# RBAC System

> Roles, permissions, and how authorization decisions are made. Source files under `src/domain/rbac/`, `src/application/rbac/`, and the guards in `src/infra/http/guards/`.

## Mental Model

- **Permission** — atomic capability identified by `module.action` (e.g. `student.create`).
- **Role** — named bundle of permissions, optionally scoped to a campus.
- **UserRole** — assignment of a Role to a User, optionally scoped to a campus.

There is no "user.role" — a user can hold many roles, and the same role can be assigned multiple times in different campuses.

```
User ──UserRole──> Role ──RolePermission──> Permission
                    │
              (optional campusId)
```

## Schema

```prisma
model Permission {
  id          String  @id @db.Text       // module.action format, e.g. "student.create"
  module      String
  description String?
  rolePermissions RolePermission[]
  createdAt DateTime @default(now())
  @@index([module])
}

model Role {
  id              String  @id @default(uuid()) @db.Uuid
  campusId        String? @map("campus_id") @db.Uuid          // null = system-level role
  name            String
  description     String?
  isSystemDefault Boolean @default(false) @map("is_system_default")
  isSystemRole    Boolean @default(false) @map("is_system_role")  // ⚠ grants global admin bypass
  permissions     Json    @default("{}")                        // Deprecated; use RolePermission
  campus          Campus?          @relation(fields: [campusId], references: [id], onDelete: Restrict)
  userRoles       UserRole[]
  rolePermissions RolePermission[]
  staffTypes      StaffType[]                                    // a StaffType can default to this role
  @@unique([campusId, name])
  @@index([campusId])
}

model RolePermission {
  roleId       String @db.Uuid
  permissionId String @db.Text
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
}

model UserRole {
  id       String  @id @default(uuid()) @db.Uuid
  userId   String  @db.Uuid
  roleId   String  @db.Uuid
  campusId String? @db.Uuid     // null = global assignment (this role applies in every campus)
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  role     Role    @relation(fields: [roleId], references: [id], onDelete: Cascade)
  campus   Campus? @relation(fields: [campusId], references: [id], onDelete: Cascade)
  assignedAt DateTime @default(now())
  @@unique([userId, roleId, campusId])
}
```

## Permission ID Format

`module.action`, lowercase, snake-case for multi-word modules:

```
campus.create        student.read         post.delete
class.update         file.list            attendance.update
grade_level.create   school_year.delete   staff_type.update
```

Validated by `PermissionEntity.validateId(id)` and `parseId(id)`. The valid modules and actions are constants in `src/domain/rbac/entities/permission.entity.ts`:

```typescript
static readonly VALID_MODULES = [
  "campus", "student", "guardian", "staff", "class", "grade_level",
  "subject", "school_year", "post", "file", "role", "user",
  "attendance", "staff_type", "report", "setting",
] as const;

static readonly VALID_ACTIONS = [
  "create", "read", "update", "delete", "list",
  "manage", "assign", "export", "import",
] as const;
```

The full catalogue is **seeded** by `SeedPermissionsUseCase` (`src/application/rbac/use-cases/seed-permissions.use-case.ts`) — idempotent, runs at system bootstrap.

## Role Scoping

| `Role.campusId` | Meaning | Examples |
|------------------|---------|----------|
| `null` | System role — defines a template that can be assigned globally | "Super Admin", "Operations Manager" |
| `string` | Campus-specific role | "Teacher" at Campus A, distinct from "Teacher" at Campus B |

Role names must be unique within a campus (or globally for `campusId = null`):

```prisma
@@unique([campusId, name])
```

This means **two campuses can independently define a "Teacher" role** with different permissions.

## `isSystemRole` — The Global Admin Bypass

A role with `isSystemRole = true` grants the holder global administrator privileges. The flag:

- **Can only be set via seeds or migrations** — never via the public API.
- Is read by `isGlobalAdmin(user)` in `src/infra/http/context/campus-context.ts`.
- Is used by `CampusGuard` to bypass campus access checks (when `allowGlobalAdmin: true`, the default).
- Is used by `ApprovePostUseCase`, `RejectPostUseCase`, `PinPostUseCase` for "admin only" actions.

```typescript
export function isGlobalAdmin(user: User): boolean {
  // SECURITY: Uses isSystemRole flag, not name-based checks.
  // Prevents privilege escalation via role naming (e.g. "Super VIP" → admin).
  return user.getGlobalRoles().some(role => role.isSystemRole === true);
}
```

> **Never check role name strings** like `role.name === "Admin"` for security decisions. Names are user-editable.

## UserRole Assignments

A user can hold the same role in multiple campuses, or the same role globally. The `UserRole` table is the join with optional campus context:

```ts
const user = {
  roleAssignments: [
    { role: superAdmin, campusId: null,        assignedAt: ... },  // applies everywhere
    { role: teacher,     campusId: "campus-a",  assignedAt: ... },  // only Campus A
    { role: principal,   campusId: "campus-b",  assignedAt: ... },  // only Campus B
  ],
};
```

`User` exposes typed accessors:

| Method | Returns |
|--------|---------|
| `user.getRolesForCampus(campusId)` | All roles applicable in the given campus (campus-specific + global) |
| `user.getGlobalRoles()` | Only the globally assigned roles |
| `user.hasRoleInCampus(roleId, campusId)` | Boolean |
| `user.hasSystemRole()` | True if any global role has `isSystemRole = true` |
| `user.getAccessibleCampusIds()` | All campus IDs where the user has any campus-specific assignment |
| `user.hasGlobalRole()` | True if any assignment has `campusId = null` |

These methods are the source of truth — guards never traverse `UserRole` rows directly.

## How Authorization Decisions Are Made

The four guards collaborate in this order. See [@doc/patterns/guards-pattern](patterns/guards-pattern) for full details.

```
1. ClerkAuthGuard      → "is the request authenticated?" (clerkId present)
2. CampusGuard         → "does the campus exist, is it active, and does the user have access?"
3. PermissionsGuard    → "does the user hold any required permission in this campus?"
   (or RolesGuard      → "does the user hold any required role name in this campus?")
```

`PermissionsGuard.canActivate(...)`:

```typescript
const user = await this.requestContext.getUser();
const campusId = this.requestContext.campusId;
const applicableRoles = user.getRolesForCampus(campusId);
const userPermissionIds = new Set<string>(
  applicableRoles.flatMap(r => (r.permissions ?? []).map(p => p.id)),
);
return requiredPermissions.some(p => userPermissionIds.has(p));   // OR logic
```

Permission checking is **OR**: any one matching permission allows the request. For "must have all" scenarios, decompose into multiple endpoints or check inside the use case.

## StaffType → Default Role

Each `StaffType` can specify a `defaultRoleId`. When a staff member is created with that type, `CreateStaffUseCase` automatically assigns the default role in the same campus:

```prisma
model StaffType {
  campusId      String  @db.Uuid
  defaultRoleId String? @map("default_role_id") @db.Uuid
  defaultRole   Role?   @relation(fields: [defaultRoleId], references: [id], onDelete: SetNull)
}
```

```typescript
// CreateStaffUseCase
if (defaultRoleId) {
  await tx.assignRoles(user.id, [
    { roleId: defaultRoleId, campusId: input.campusId },
  ]);
}
```

This keeps "what role does a teacher get?" as configuration, not code. New StaffTypes can be added per campus without modifying the use case.

## Seeding Permissions

`SeedPermissionsUseCase.execute()` is idempotent:

1. Iterate `SYSTEM_PERMISSIONS` (60+ entries).
2. For each, check if it already exists (`permissionRepository.exists(id)`).
3. If not, save it.

Run at:

- Cold-start initialization (bootstrap script).
- Whenever new permissions are added (just re-run the seed).

The full list lives in `src/application/rbac/use-cases/seed-permissions.use-case.ts`.

## Adding a New Permission

1. Add an entry to `SYSTEM_PERMISSIONS` in `seed-permissions.use-case.ts` (`{ id: "module.action", module, description }`).
2. Re-run `SeedPermissionsUseCase` (typically tied to deployment).
3. Decide which roles get it — assign via `AssignPermissionsToRoleUseCase` or in seed scripts.
4. Apply on the route: `@UseGuards(PermissionsGuard) @Permissions("module.action")`.

## Adding a New System Role

System roles can only be created via seeds/migrations:

```typescript
const role = await prisma.role.create({
  data: {
    name: "Operations Manager",
    campusId: null,
    isSystemDefault: true,
    isSystemRole: true,           // ⚠ explicit; grants admin bypass
  },
});
await prisma.rolePermission.createMany({
  data: permissionIds.map(permissionId => ({ roleId: role.id, permissionId })),
});
```

`isSystemDefault: true` prevents the role from being modified through the management endpoints (`AssignPermissionsToRoleUseCase` rejects with `BadRequestException("Cannot modify permissions of system default roles")`).

## RBAC Module Structure

```
src/domain/rbac/
├── entities/
│   ├── permission.entity.ts      # interface + PermissionEntity static helpers
│   └── permission.entity.spec.ts
└── index.ts

src/application/rbac/
├── ports/permission.repository.ts
├── use-cases/
│   ├── seed-permissions.use-case.ts
│   ├── get-all-permissions.use-case.ts
│   ├── get-permissions-by-module.use-case.ts
│   ├── assign-permissions-to-role.use-case.ts
│   ├── remove-permissions-from-role.use-case.ts
│   └── rbac-campus-scoping.integration.spec.ts
└── index.ts

src/infra/http/modules/rbac.module.ts
src/infra/persistence/prisma/repositories/prisma-permission.repository.ts
src/infra/persistence/prisma/mapper/prisma-permission.mapper.ts
```

Roles live under `user-management` (`src/domain/user-management/role.entity.ts`) — the historical reason is they were modelled before RBAC was extracted into its own module.

## Cross-Campus Considerations

The `rbac-campus-scoping.integration.spec.ts` integration test verifies:

- Roles in Campus A are not assignable to users in Campus B (when checked at the use case level).
- Permission assignments respect role scope.
- `isSystemRole` bypass works exactly when expected.

When extending the system, **always check campus ownership** at use case boundaries. The schema doesn't enforce role-vs-user-campus matching across `UserRole.campusId`; that's an application-level invariant.

## Pitfalls

| Mistake | Impact |
|---------|--------|
| Setting `isSystemRole = true` from the API | Privilege escalation. Block at the use case (only seeds/migrations) |
| Checking `role.name === "Admin"` for authorization | Renaming or copying the role bypasses the check. Use `isSystemRole` |
| Forgetting to seed permissions before assigning them | `AssignPermissionsToRoleUseCase` 400s with "Invalid permission IDs" |
| Checking `roleAssignments[0]` directly | First assignment is not "the role" — iterate all |
| Cascading `RolePermission` deletes when removing a permission | Done correctly in schema (`onDelete: Cascade`) — don't change |
| Allowing duplicate role names in different campuses | Don't — the unique constraint `[campusId, name]` already permits this; it's by design |

## Reference

| File | Notes |
|------|-------|
| `src/domain/rbac/entities/permission.entity.ts` | Permission interface + `PermissionEntity.validateId/parseId/buildId` |
| `src/domain/user-management/role.entity.ts` | Role interface + `RoleEntity.hasPermission`, scope helpers |
| `src/domain/user-management/user.entity.ts` | `getRolesForCampus`, `hasSystemRole`, etc. |
| `src/application/rbac/use-cases/seed-permissions.use-case.ts` | The catalogue |
| `src/infra/http/guards/permissions.guard.ts` | Decision logic |
| `src/infra/http/context/campus-context.ts` | `isGlobalAdmin` bypass |
