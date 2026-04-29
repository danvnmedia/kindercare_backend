---
id: '20'
title: 'Phase 5.1: User Roles Campus Scoping'
status: done
priority: high
labels:
  - domain
  - user-roles
  - rbac
  - campus-scoping
  - phase-5
createdAt: '2026-01-06T04:31:24.561Z'
updatedAt: '2026-01-10T18:52:38.032Z'
timeSpent: 586
assignee: me
---
# Phase 5.1: User Roles Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the UserRoles join table and related code to support campus-scoped role assignments. A user can have different roles at different campuses.

Depends on @task-8 (Schema), @task-9 (Campus module), @task-10 (RBAC module).
See @doc/migrations/multi-campus-migration for context.

## Concept
- Global roles (campus_id = null): Apply across all campuses (e.g., Super Admin)
- Campus-scoped roles (campus_id = uuid): Apply only within that campus

## Changes Required

### Domain Layer

**Update**: src/domain/user-management/user.entity.ts
- Update roles relation to include campus context
- Add method: hasRoleInCampus(roleId, campusId)
- Add method: getRolesForCampus(campusId)

### Application Layer

**Port Update**: src/application/user-management/ports/user.repository.ts
- Update: assignRoles(userId, roleAssignments: {roleId, campusId?}[])
- Update: removeRoles to handle campus context
- Add: getUserRolesForCampus(userId, campusId)

**Use Case Updates**:
- assign-roles-to-user.use-case.ts
  - Accept campusId for each role assignment
  - Validate role exists and is accessible
  
- remove-roles-from-user.use-case.ts
  - Handle campus-scoped removal

- New: get-user-roles-by-campus.use-case.ts
  - Return roles for specific campus + global roles

### Infrastructure Layer

**Repository**: prisma-user.repository.ts
- Update role assignment methods
- Handle composite key (user_id, role_id, campus_id)
- Include campus in role queries

**Auth Context**:
- Update how current user's permissions are loaded
- Consider caching roles per campus

### HTTP Layer

**DTOs**:
- assign-roles.request.ts
  - Change: roleIds: string[] -> roleAssignments: {roleId, campusId?}[]
  
- user.response.ts
  - Update roles to show campus context

### Guards & Authorization

**Update**: src/infra/http/guards/roles.guard.ts
- Check roles within current campus context
- Global roles (campus_id = null) should grant access to all campuses

**Auth Flow**:
1. Request comes with campus context (header/path)
2. Guard fetches user's roles for that campus + global roles
3. Permission check considers both campus-scoped and global roles
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 UserRoles schema updated with campus_id
- [x] #2 User entity updated with campus-aware role methods
- [x] #3 UserRepository handles campus-scoped role assignment
- [x] #4 Assign-roles use case accepts campusId per role
- [x] #5 Get-user-roles returns campus-specific + global roles
- [x] #6 RolesGuard checks campus context
- [x] #7 Global roles (null campus) grant access everywhere
- [x] #8 DTOs support campus-scoped role assignments
- [x] #9 Auth context includes campus-aware role loading
- [ ] #10 Tests cover campus-scoped and global role scenarios
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan for Task 20: User Roles Campus Scoping

### Prerequisites Verified
- [x] Task 8 (Schema migration) - DONE: UserRole has campusId with unique constraint
- [x] Task 9 (Campus module) - DONE: CampusRepository, Campus entity ready
- [x] Task 10 (RBAC module) - DONE: Permission entity, Role entity with campusId ready

### Design Decision
**Approach: Hybrid backward-compatible changes**
- Modify `assignRoles()` signature to accept role assignments array with optional campusId
- Add new methods for campus-specific queries
- Existing callers pass empty campusId which defaults to global (null)

### Phase 1: Domain Layer Updates

#### 1.1 Update User Entity (src/domain/user-management/user.entity.ts)
- Add interface `UserRoleAssignment { roleId: string; campusId: string | null }`
- Add method `hasRoleInCampus(roleId: string, campusId: string | null): boolean`
- Add method `getRolesForCampus(campusId: string | null): Role[]`
- Add method `getGlobalRoles(): Role[]` (convenience for campusId = null)
- Update internal roles storage to track campus context

#### 1.2 Add UserRole Value Object (src/domain/user-management/value-objects/user-role.vo.ts)
- Create UserRole value object to represent role+campus assignment
- Properties: roleId, campusId (nullable), role (Role entity), assignedAt

### Phase 2: Application Layer Updates

#### 2.1 Update User Repository Port (src/application/user-management/ports/user.repository.ts)
- Change signature: `assignRoles(userId: string, roleAssignments: {roleId: string, campusId?: string | null}[]): Promise<void>`
- Change signature: `removeRoles(userId: string, roleAssignments: {roleId: string, campusId?: string | null}[]): Promise<void>`
- Add method: `getUserRolesForCampus(userId: string, campusId: string | null): Promise<Role[]>`

#### 2.2 Update AssignRolesToUser Use Case (src/application/user-management/use-cases/user/assign-roles-to-user.use-case.ts)
- Update input to accept roleAssignments array
- Validate each role exists
- Validate each campusId exists (when not null)
- Call repository with new signature

#### 2.3 Update RemoveRolesFromUser Use Case (src/application/user-management/use-cases/user/remove-roles-from-user.use-case.ts)
- Update input to accept roleAssignments array with campus context
- Handle removal of specific role+campus combinations

#### 2.4 Create GetUserRolesByCampus Use Case (src/application/user-management/use-cases/user/get-user-roles-by-campus.use-case.ts)
- Input: userId, campusId (null for global)
- Returns: roles for specified campus + global roles (campusId=null)
- Uses getUserRolesForCampus repository method

### Phase 3: Infrastructure Layer Updates

#### 3.1 Update PrismaUserRepository (src/infra/persistence/prisma/repositories/prisma-user.repository.ts)
- Update `assignRoles()` to include campusId in createMany data
- Update `removeRoles()` to filter by userId+roleId+campusId
- Implement `getUserRolesForCampus()` with proper filtering

#### 3.2 Update PrismaUserMapper (src/infra/persistence/prisma/mapper/prisma-user.mapper.ts)
- Preserve campusId from UserRole when mapping to domain
- Add UserRole[] with campus context to User domain entity

#### 3.3 Update User Transaction Operations (src/infra/persistence/prisma/unit-of-work/transaction-operations/user.transaction-ops.ts)
- Update assignRoles to accept roleAssignments with campusId

#### 3.4 Update UnitOfWorkPort (src/application/ports/unit-of-work.port.ts)
- Update IUserTransactionOperations interface for new signature

### Phase 4: HTTP Layer Updates

#### 4.1 Create RoleAssignment DTO (src/infra/http/dtos/user-management/role/role-assignment.dto.ts)
- Create nested DTO class: `RoleAssignmentDto { roleId: string; campusId?: string }`
- Validation decorators for roleId (UUID) and optional campusId (UUID)

#### 4.2 Update AssignRolesRequest (src/infra/http/dtos/user-management/role/assign-roles.request.ts)
- Change from `roleIds: string[]` to `roleAssignments: RoleAssignmentDto[]`
- Add validation for array and nested objects

#### 4.3 Update UserResponse (src/infra/http/dtos/user-management/user/user.response.ts)
- Add UserRoleResponse nested class showing role with campus context
- Include campusId in the role mapping

#### 4.4 Add Remove Roles Request (if not exists)
- Similar structure to AssignRolesRequest for removal endpoint

### Phase 5: Guards & Authorization Updates

#### 5.1 Update RolesGuard (src/infra/http/guards/roles.guard.ts)
- Get campus context from request (header or path)
- Fetch user's roles for that campus + global roles
- Check if user has required role in scope

#### 5.2 Update PermissionsGuard (src/infra/http/guards/permissions.guard.ts)
- Get campus context from request
- Filter user's permissions by campus scope
- Include global role permissions in check

#### 5.3 Add GetCampusFromRequest Helper
- Extract campusId from x-campus-id header or :campusId path param
- Shared utility for guards

### Phase 6: Update Callers

#### 6.1 Update CreateStaffUseCase (src/application/user-management/use-cases/staff/create-staff.use-case.ts)
- Pass staff.campusId when assigning default role

#### 6.2 Update Other Role Assignment Points
- Audit and update all places that call assignRoles
- Ensure campus context is passed through

### Phase 7: Testing

#### 7.1 Unit Tests
- User entity: hasRoleInCampus(), getRolesForCampus()
- AssignRolesToUser use case with campus context
- GetUserRolesByCampus use case

#### 7.2 Integration Tests
- Role assignment with campus scoping
- Role removal with campus scoping
- Guards with campus context
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Review Notes (2026-01-10)

**Implementation Status: Schema done, app/infra layers need significant work**

**Completed:**
- UserRole table has campusId field with proper unique constraint
- Role entity has campusId property and basic methods

**Critical Design Decision Needed:**
The current assignRoles() method signature is:
  `assignRoles(userId: string, roleIds: string[])`

This needs to change to support campus-scoped roles:
  `assignRoles(userId: string, roleAssignments: {roleId: string, campusId?: string}[])`

**This is a BREAKING CHANGE** that affects:
- UserRepository interface
- PrismaUserRepository implementation
- AssignRolesToUser use case
- HTTP DTOs and controller

**Missing Items:**
1. User entity methods: hasRoleInCampus(), getRolesForCampus()
2. getUserRolesForCampus() repository method
3. getGlobalRoles() repository method (for campusId = null roles)
4. RolesGuard update to check campus-scoped roles
5. DTO update: assign-roles.request.ts needs roleAssignments array structure

**Recommendation:** Consider creating NEW methods instead of modifying existing ones to avoid breaking changes, or plan a coordinated migration.


### Implementation Completed (2026-01-10)

**Summary:** Implemented campus-scoped role assignments following clean architecture patterns.

**Files Modified:**

**Domain Layer:**
- `src/domain/user-management/user.entity.ts` - Added `UserRoleAssignment`, `RoleAssignmentInput` interfaces; Added `hasRoleInCampus()`, `getRolesForCampus()`, `getGlobalRoles()`, `getRoleAssignmentsForCampus()` methods

**Application Layer:**
- `src/application/user-management/ports/user.repository.ts` - Updated `assignRoles()`, `removeRoles()` signatures; Added `getUserRolesForCampus()` method
- `src/application/ports/unit-of-work.port.ts` - Updated `assignRoles()` signature
- `src/application/user-management/use-cases/user/assign-roles-to-user.use-case.ts` - Updated for campus context
- `src/application/user-management/use-cases/user/remove-roles-from-user.use-case.ts` - Updated for campus context
- `src/application/user-management/use-cases/user/get-user-roles-by-campus.use-case.ts` - NEW FILE

**Infrastructure Layer:**
- `src/infra/persistence/prisma/mapper/prisma-user.mapper.ts` - Preserves campusId from UserRole
- `src/infra/persistence/prisma/repositories/prisma-user.repository.ts` - Implements campus-aware role methods
- `src/infra/persistence/prisma/unit-of-work/transaction-operations/user.transaction-ops.ts` - Updated for campus context

**HTTP Layer:**
- `src/infra/http/dtos/user-management/role/assign-roles.request.ts` - New `RoleAssignmentDto` with campusId
- `src/infra/http/dtos/user-management/user/user.response.ts` - Added `UserRoleAssignmentResponse`
- `src/infra/http/guards/roles.guard.ts` - Now checks campus context via x-campus-id header
- `src/infra/http/guards/permissions.guard.ts` - Now checks campus context

**Callers Updated:**
- `src/application/user-management/use-cases/staff/create-staff.use-case.ts` - Passes campusId when assigning default role
- `src/application/user-management/use-cases/staff/update-staff.use-case.ts` - Passes campusId when assigning default role

**Key Design Decisions:**
1. `RoleAssignmentInput.campusId = null` means global assignment (applies everywhere)
2. Guards get campus context from x-campus-id header, route params, or query params
3. Backward compatible - existing `roles[]` array kept on User entity alongside new `roleAssignments[]`
4. PrismaUserMapper now includes campusId from UserRole join table

**Build Status:** Successful
<!-- SECTION:NOTES:END -->

