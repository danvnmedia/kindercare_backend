---
id: u11f0t
title: Add isSystemRole flag to Role entity for secure global admin detection
status: done
priority: high
labels:
  - security
  - refactor
  - role
createdAt: '2026-01-12T00:01:39.877Z'
updatedAt: '2026-01-12T01:29:13.899Z'
timeSpent: 638
assignee: '@me'
---
# Add isSystemRole flag to Role entity for secure global admin detection

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the insecure name-based global admin check with an explicit isSystemRole flag. Currently, any role with 'admin' or 'super' in the name gets bypass privileges, which is a security vulnerability (e.g., 'Super VIP' would get admin access).

## Problem
The current isGlobalAdmin() function in campus-context.ts checks role names:
\
## Solution
Add isSystemRole: boolean field to Role entity. Only roles explicitly marked as system roles (via seeds/migrations) can bypass campus checks. School admins cannot create/modify/delete system roles via API.

## Key Principle
- isSystemRole can only be set to true via database seeds or migrations
- API endpoints must reject any attempt to set isSystemRole = true
- System roles cannot be modified or deleted via API

## Files to Modify (18 files)

### Domain Layer
- src/domain/user-management/role.entity.ts

### Application Layer
- src/application/user-management/ports/role.repository.ts
- src/application/user-management/use-cases/role/create-role.use-case.ts
- src/application/user-management/use-cases/role/update-role.use-case.ts
- src/application/user-management/use-cases/role/delete-role.use-case.ts

### Infrastructure - Persistence
- prisma/schema.prisma
- src/infra/persistence/prisma/mapper/prisma-role.mapper.ts
- src/infra/persistence/prisma/repositories/prisma-role.repository.ts

### Infrastructure - HTTP
- src/infra/http/context/campus-context.ts
- src/infra/http/guards/campus.guard.ts
- src/infra/http/dtos/user-management/role/role.response.ts
- src/infra/http/dtos/user-management/role/create-role.request.ts
- src/infra/http/controllers/user-management/role.controller.ts

### Seeds & CLI
- src/cli/create-admin.ts
- prisma/seed.ts (if system roles need seeding)

### Tests
- src/test-utils/entity-factories.ts
- src/domain/user-management/role.entity.spec.ts
- src/infra/http/guards/campus.guard.spec.ts
- src/application/rbac/use-cases/rbac-campus-scoping.integration.spec.ts

## References
- @doc/architecture/multi-campus-architecture
- @doc/patterns/repository-pattern
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add isSystemRole: boolean field to Role interface and entity (default: false)
- [x] #2 Add isSystemRole column to Prisma schema with migration
- [x] #3 Update Prisma role mapper to map isSystemRole field
- [x] #4 Update create-role use-case to reject isSystemRole=true from API
- [x] #5 Update update-role use-case to prevent modification of system roles
- [x] #6 Update delete-role use-case to prevent deletion of system roles
- [x] #7 Replace name-based check in isGlobalAdmin() with isSystemRole flag check
- [x] #8 Update RoleResponse DTO to expose isSystemRole field
- [x] #9 Update create-admin CLI to set isSystemRole=true for admin role
- [x] #10 Update test factories to include isSystemRole field
- [x] #11 Add tests verifying name-based checks no longer grant admin access
- [x] #12 Add tests verifying isSystemRole=true grants admin bypass
- [x] #13 All existing tests pass after changes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Domain & Schema Layer
1. Add isSystemRole: boolean field to Role interface in role.entity.ts (default: false)
2. Add isSystemRole column to Prisma schema with @default(false)
3. Create Prisma migration for the new column
4. Update PrismaRoleMapper to map isSystemRole field in all methods (toDomain, toDomainSimple, toPrisma, toPrismaUpdate)

### Phase 2: Application Layer - Use Cases
5. Update create-role.use-case.ts to reject isSystemRole=true from API (throw BadRequestException)
6. Update update-role.use-case.ts to prevent modification of roles where isSystemRole=true
7. Update delete-role.use-case.ts to prevent deletion of roles where isSystemRole=true

### Phase 3: Infrastructure - HTTP Layer  
8. Update RoleResponse DTO to expose isSystemRole field
9. Update CreateRoleRequest DTO - remove isSystemRole or ensure it's always rejected
10. Replace name-based check in isGlobalAdmin() with isSystemRole flag check

### Phase 4: CLI & Seeds
11. Update create-admin CLI to set isSystemRole=true for admin role
12. Update prisma/seed.ts to set isSystemRole=true for seeded system roles (if applicable)

### Phase 5: Tests
13. Update entity-factories.ts to include isSystemRole field in createRole factory
14. Add tests verifying name-based checks no longer grant admin access
15. Add tests verifying isSystemRole=true grants admin bypass
16. Run all existing tests to verify no regressions

### Phase 6: Verification
17. Run prisma generate and verify types
18. Run full test suite
19. Manual verification of guard behavior
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Replaced the insecure name-based global admin check with an explicit isSystemRole boolean flag. This fixes a security vulnerability where any role with 'admin' or 'super' in the name would grant global admin bypass privileges.

## Changes Made

### Domain Layer
- Added isSystemRole: boolean field to Role interface (role.entity.ts:15)
- Added isSystemRole to CreateRoleData interface (role.entity.ts:30)
- Added static isSystemRole() method to RoleEntity class (role.entity.ts:107-112)

### Database Layer
- Added isSystemRole column to Prisma schema with @default(false) (schema.prisma:109)
- Created migration: 20260112012105_add_is_system_role_to_role

### Application Layer
- create-role.use-case.ts: Rejects isSystemRole=true from API with BadRequestException
- update-role.use-case.ts: Prevents modification of roles where isSystemRole=true
- delete-role.use-case.ts: Prevents deletion of roles where isSystemRole=true (was previously unprotected)

### Infrastructure Layer
- campus-context.ts: Replaced name-based check with isSystemRole flag check in isGlobalAdmin()
- prisma-role.mapper.ts: Updated toDomain, toDomainSimple, and toPrisma to map isSystemRole
- role.response.ts: Added isSystemRole field with API documentation

### CLI & Seeds
- create-admin.ts: Sets isSystemRole=true when creating admin role, also upgrades existing admin roles

### Tests
- entity-factories.ts: Added isSystemRole to createRole factory
- role.entity.spec.ts: Added tests for isSystemRole static method
- campus.guard.spec.ts: Updated tests to use isSystemRole=true instead of name-based checks
- rbac-campus-scoping.integration.spec.ts: Updated isGlobalAdmin tests to verify new secure behavior

## Security Impact
- Fixes vulnerability: Roles named 'Super VIP' or 'Admin Assistant' can no longer bypass campus checks
- Only roles explicitly marked with isSystemRole=true (via seeds/migrations) can bypass campus checks
- API endpoints reject any attempt to set isSystemRole=true

## Tests
- All 358 tests pass
- Added 5 new test cases for isSystemRole behavior
<!-- SECTION:NOTES:END -->

