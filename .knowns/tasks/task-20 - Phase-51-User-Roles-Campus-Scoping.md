---
id: '20'
title: 'Phase 5.1: User Roles Campus Scoping'
status: todo
priority: high
labels:
  - domain
  - user-roles
  - rbac
  - campus-scoping
  - phase-5
createdAt: '2026-01-06T04:31:24.561Z'
updatedAt: '2026-01-06T04:31:24.561Z'
timeSpent: 0
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
- [ ] #1 UserRoles schema updated with campus_id
- [ ] #2 User entity updated with campus-aware role methods
- [ ] #3 UserRepository handles campus-scoped role assignment
- [ ] #4 Assign-roles use case accepts campusId per role
- [ ] #5 Get-user-roles returns campus-specific + global roles
- [ ] #6 RolesGuard checks campus context
- [ ] #7 Global roles (null campus) grant access everywhere
- [ ] #8 DTOs support campus-scoped role assignments
- [ ] #9 Auth context includes campus-aware role loading
- [ ] #10 Tests cover campus-scoped and global role scenarios
<!-- AC:END -->

