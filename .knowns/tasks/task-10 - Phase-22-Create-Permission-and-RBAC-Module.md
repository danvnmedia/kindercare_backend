---
id: '10'
title: 'Phase 2.2: Create Permission and RBAC Module'
status: done
priority: high
labels:
  - domain
  - rbac
  - permission
  - role
  - phase-2
createdAt: '2026-01-06T04:27:54.272Z'
updatedAt: '2026-01-07T02:44:19.138Z'
timeSpent: 1180
assignee: '@me'
---
# Phase 2.2: Create Permission and RBAC Module

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the Permission entity and update the Role entity for the new RBAC system with campus scoping.

Depends on @task-8 (Schema migration), @task-9 (Campus module).
See @doc/migrations/multi-campus-migration for context.
See @doc/patterns/entity-pattern for patterns.

## Domain Layer Changes

### New Entity: Permission
**File**: src/domain/rbac/entities/permission.entity.ts
- Properties: id (text, e.g., 'student.create'), module, description
- Factory method with validation
- Permissions are code-based and static

### Updated Entity: Role
**File**: src/domain/user-management/role.entity.ts (UPDATE existing)
- Add: campusId (optional - null for system defaults)
- Add: isSystemDefault boolean
- Remove: permissions JSON field (replaced by role_permission relation)
- Add: permissions relation (array of Permission)
- Update domain methods for permission checking

### New Entity: RolePermission (if needed as aggregate)
- May be handled purely at repository level

## Application Layer

### New Port: PermissionRepository
**File**: src/application/rbac/ports/permission.repository.ts
- findById(id): Promise<Permission | null>
- findAll(): Promise<Permission[]>
- findByModule(module: string): Promise<Permission[]>
- save(permission: Permission): Promise<Permission>

### Updated Port: RoleRepository
**File**: src/application/user-management/ports/role.repository.ts
- Add: findByCampusId(campusId): Promise<Role[]>
- Add: findSystemDefaults(): Promise<Role[]>
- Update methods to include permissions relation
- Add: assignPermissions(roleId, permissionIds)
- Add: removePermissions(roleId, permissionIds)

### New Use Cases
- create-permission.use-case.ts (admin only, seeding)
- get-all-permissions.use-case.ts
- assign-permissions-to-role.use-case.ts
- remove-permissions-from-role.use-case.ts

### Updated Use Cases
- create-role.use-case.ts - Add campusId parameter
- update-role.use-case.ts - Handle campusId updates

## Infrastructure Layer

### Prisma Repositories
- prisma-permission.repository.ts (new)
- prisma-role.repository.ts (update for campus + permissions)

### Mappers
- prisma-permission.mapper.ts (new)
- prisma-role.mapper.ts (update)

## HTTP Layer

### Updated Controller: RoleController
- Update endpoints to handle campusId
- Add permission assignment endpoints

### New DTOs
- permission.response.ts
- assign-permissions.request.ts

### Updated DTOs
- create-role.request.ts - Add campusId
- role.response.ts - Add campusId, permissions array
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Permission entity created with proper validation
- [x] #2 Role entity updated with campusId and isSystemDefault
- [x] #3 Role entity permissions changed from JSON to relation
- [x] #4 PermissionRepository port created
- [x] #5 RoleRepository updated with campus-aware methods
- [x] #6 Permission use cases created
- [x] #7 Role use cases updated for campus context
- [x] #8 Prisma repositories implemented/updated
- [x] #9 DTOs updated with new fields
- [x] #10 Guards updated for new permission structure
- [x] #11 Unit tests updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Domain Layer

### 1.1 Create Permission Entity
**File**: src/domain/rbac/entities/permission.entity.ts
- Interface-based pattern (consistent with existing Role entity)
- Props: id (text, e.g., 'student.create'), module, description, createdAt
- PermissionEntity class with validation
- ID format: `{module}.{action}` (e.g., 'student.create', 'class.read')

### 1.2 Update Role Entity
**File**: src/domain/user-management/role.entity.ts
- Add campusId: string | null (null for system defaults)
- Add isSystemDefault: boolean
- Change permissions type from Record<string,any> to Permission[] array
- Update RoleEntity.hasPermission() to use new Permission type
- Update CreateRoleData, UpdateRoleData interfaces

## Phase 2: Application Layer

### 2.1 Create PermissionRepository Port
**File**: src/application/rbac/ports/permission.repository.ts
- findById(id): Promise<Permission | null>
- findAll(): Promise<Permission[]>
- findByModule(module: string): Promise<Permission[]>
- save(permission: Permission): Promise<Permission>
- exists(id: string): Promise<boolean>

### 2.2 Update RoleRepository Port
**File**: src/application/user-management/ports/role.repository.ts
- Add findByCampusId(campusId: string | null): Promise<Role[]>
- Add findSystemDefaults(): Promise<Role[]>
- Update findByName to include campusId parameter (campus-scoped uniqueness)
- Add assignPermissions(roleId: string, permissionIds: string[]): Promise<void>
- Add removePermissions(roleId: string, permissionIds: string[]): Promise<void>
- Add getPermissions(roleId: string): Promise<Permission[]>

### 2.3 Create Permission Use Cases
**Files**: src/application/rbac/use-cases/
- create-permission.use-case.ts (for seeding)
- get-all-permissions.use-case.ts
- get-permissions-by-module.use-case.ts

### 2.4 Update Role Use Cases
**Files**: src/application/user-management/use-cases/
- Update create-role.use-case.ts - Add campusId parameter
- Update update-role.use-case.ts - Handle campusId, isSystemDefault
- Create assign-permissions-to-role.use-case.ts
- Create remove-permissions-from-role.use-case.ts

## Phase 3: Infrastructure Layer

### 3.1 Create Permission Mapper
**File**: src/infra/persistence/prisma/mapper/prisma-permission.mapper.ts
- toDomain(), toPrisma(), toDomainArray()

### 3.2 Update Role Mapper
**File**: src/infra/persistence/prisma/mapper/prisma-role.mapper.ts
- Add campusId, isSystemDefault mapping
- Add rolePermissions -> permissions mapping (include full Permission objects)
- Update toPrisma() for new fields

### 3.3 Create PrismaPermissionRepository
**File**: src/infra/persistence/prisma/repositories/prisma-permission.repository.ts
- Implement PermissionRepository port
- Simple CRUD operations

### 3.4 Update PrismaRoleRepository
**File**: src/infra/persistence/prisma/repositories/prisma-role.repository.ts
- Add campus filtering to all queries
- Include rolePermissions relation with Permission
- Implement assignPermissions, removePermissions methods
- Update findByName to accept campusId

## Phase 4: HTTP Layer

### 4.1 Update Role DTOs
**Files**: src/infra/http/dtos/user-management/role/
- Update create-role.request.ts - Add campusId
- Update update-role.request.ts - Add campusId
- Update role.response.ts - Add campusId, isSystemDefault, permissions array
- Create assign-permissions.request.ts

### 4.2 Create Permission DTOs
**Files**: src/infra/http/dtos/rbac/
- permission.response.ts

### 4.3 Update RoleController
**File**: src/infra/http/controllers/user-management/role.controller.ts
- Add POST /:id/permissions endpoint
- Add DELETE /:id/permissions endpoint
- Update existing endpoints to handle campusId

### 4.4 Create RbacModule
**File**: src/infra/http/modules/rbac.module.ts
- Register PermissionRepository
- Register Permission use cases
- Export for use by other modules

## Phase 5: Guards Update

### 5.1 Update RolesGuard
**File**: src/infra/http/guards/roles.guard.ts
- Update to use new Permission[] structure
- Check permissions via role.permissions array

## Phase 6: Testing

### 6.1 Unit Tests
- Permission entity tests
- Role entity tests (updated)
- Permission use cases tests
- Role use cases tests (updated)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Implemented the Permission entity and updated the Role entity for the new RBAC system with campus scoping. This enables fine-grained, permission-based access control with campus isolation.

## Files Created

### Domain Layer
- `src/domain/rbac/entities/permission.entity.ts` - Permission entity with validation
- `src/domain/rbac/index.ts` - Domain exports

### Application Layer
- `src/application/rbac/ports/permission.repository.ts` - Repository port
- `src/application/rbac/use-cases/get-all-permissions.use-case.ts`
- `src/application/rbac/use-cases/get-permissions-by-module.use-case.ts`
- `src/application/rbac/use-cases/seed-permissions.use-case.ts` - System permission seeding
- `src/application/rbac/use-cases/assign-permissions-to-role.use-case.ts`
- `src/application/rbac/use-cases/remove-permissions-from-role.use-case.ts`
- `src/application/rbac/index.ts` - Application exports

### Infrastructure Layer
- `src/infra/persistence/prisma/mapper/prisma-permission.mapper.ts`
- `src/infra/persistence/prisma/repositories/prisma-permission.repository.ts`
- `src/infra/http/modules/rbac.module.ts` - NestJS module

### HTTP Layer
- `src/infra/http/dtos/rbac/permission.response.ts`
- `src/infra/http/dtos/rbac/assign-permissions.request.ts`
- `src/infra/http/dtos/rbac/index.ts`
- `src/infra/http/decorators/permissions.decorator.ts`
- `src/infra/http/guards/permissions.guard.ts`

### Test Files
- `src/domain/rbac/entities/permission.entity.spec.ts` (18 tests)
- `src/domain/user-management/role.entity.spec.ts` (23 tests)

## Files Modified

### Domain Layer
- `src/domain/user-management/role.entity.ts` - Added campusId, isSystemDefault, changed permissions to Permission[]

### Application Layer
- `src/application/user-management/ports/role.repository.ts` - Added campus-aware methods
- `src/application/user-management/use-cases/role/create-role.use-case.ts` - Campus support
- `src/application/user-management/use-cases/role/update-role.use-case.ts` - Campus support

### Infrastructure Layer
- `src/infra/persistence/prisma/mapper/prisma-role.mapper.ts` - Updated for new fields
- `src/infra/persistence/prisma/repositories/prisma-role.repository.ts` - Implemented new methods
- `src/infra/persistence/prisma/mapper/index.ts` - Added exports
- `src/infra/http/modules/user-management.module.ts` - Added RbacModule import

### HTTP Layer
- `src/infra/http/controllers/user-management/role.controller.ts` - Added permission endpoints
- `src/infra/http/dtos/user-management/role/create-role.request.ts` - Campus fields
- `src/infra/http/dtos/user-management/role/update-role.request.ts` - Campus fields
- `src/infra/http/dtos/user-management/role/role.response.ts` - New response format

## Key Changes

1. **Permission Entity**: Text-based ID format `module.action` (e.g., 'student.create')
2. **Role Entity**: Added campusId (null for system defaults), isSystemDefault, permissions array
3. **Campus-scoped uniqueness**: Role names unique within campus scope
4. **Permission management**: Separate endpoints for assign/remove permissions
5. **PermissionsGuard**: New guard for permission-based access control

## API Endpoints Added
- GET /roles/permissions/all - List all available permissions
- POST /roles/:id/permissions - Assign permissions to role
- DELETE /roles/:id/permissions - Remove permissions from role

## Tests
- 41 unit tests passing for Permission and Role entities
<!-- SECTION:NOTES:END -->

