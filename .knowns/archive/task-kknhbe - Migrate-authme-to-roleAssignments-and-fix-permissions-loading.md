---
id: kknhbe
title: Migrate /auth/me to roleAssignments and fix permissions loading
status: done
priority: high
labels:
  - rbac
  - auth
  - refactor
  - cleanup
createdAt: '2026-01-13T03:19:49.016Z'
updatedAt: '2026-01-13T03:42:10.111Z'
timeSpent: 0
---
# Migrate /auth/me to roleAssignments and fix permissions loading

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate the /auth/me endpoint from deprecated 'roles' array to enterprise-grade 'roleAssignments' structure with campus context. Fix the permissions loading bug where roles are returned without their permissions. Clean up deprecated role-related code throughout the codebase.

## Problem Statement

1. **auth-me.response.ts uses deprecated structure**: Returns flat 'roles[]' array without campus context
2. **Permissions not loaded**: Repository methods don't include rolePermissions, causing roles to have empty permissions arrays
3. **Inconsistency**: user.response.ts has both 'roles' (deprecated) and 'roleAssignments' (correct), but auth-me uses only 'roles'
4. **Profile not loaded**: AuthMeResponse has 'profile' field but it's never populated
5. **PermissionsGuard workaround**: Guard re-fetches roles from roleRepository because user's roles don't have permissions

## Related Files

- src/infra/http/dtos/auth/auth-me.response.ts (uses deprecated roles)
- src/infra/http/dtos/user-management/user/user.response.ts (has both, needs cleanup)
- src/infra/persistence/prisma/repositories/prisma-user.repository.ts (missing rolePermissions)
- src/infra/http/controllers/auth/auth.controller.ts
- src/infra/http/interceptors/user.interceptor.ts
- src/infra/http/guards/permissions.guard.ts (has workaround)

## References

- @doc/architecture/multi-campus-architecture (for campus-scoped RBAC context)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 auth-me.response.ts uses roleAssignments with UserRoleAssignmentResponse instead of roles
- [x] #2 All repository methods that fetch users include rolePermissions in the query
- [x] #3 Deprecated roles field removed from user.response.ts
- [x] #4 PermissionsGuard no longer needs to re-fetch roles (permissions already loaded)
- [x] #5 Profile information (guardian/staff) is loaded and returned in /auth/me response
- [x] #6 All tests pass after migration
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Fix Repository Layer (Permissions Loading Bug)

### 1.1 Update prisma-user.repository.ts
Update ALL user fetch methods to include rolePermissions:

**Methods to update:**
- findById (line 22-27)
- findByEmail (line 29-52)  
- findByClerkUid (line 54-60)
- findAll (line 62-79)
- save (line 81-88)
- update (line 90-98)

**Change from:**
```typescript
include: { userRoles: { include: { role: true } } }
```

**Change to:**
```typescript
include: { 
  userRoles: { 
    include: { 
      role: {
        include: {
          rolePermissions: {
            include: { permission: true }
          }
        }
      }
    } 
  } 
}
```

### 1.2 Create helper constant
Add reusable include object to avoid repetition:
```typescript
const USER_WITH_ROLES_AND_PERMISSIONS = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true }
          }
        }
      }
    }
  }
};
```

---

## Phase 2: Update Auth Me Response DTO

### 2.1 Update auth-me.response.ts
- Remove: roles: RoleResponse[]
- Add: roleAssignments: UserRoleAssignmentResponse[]
- Import UserRoleAssignmentResponse from user.response.ts

### 2.2 Move UserRoleAssignmentResponse to shared location
Since both auth-me.response.ts and user.response.ts need it:
- Option A: Keep in user.response.ts, import in auth-me
- Option B: Create shared dto file

Choose Option A for simplicity.

---

## Phase 3: Update Auth Controller & Interceptor

### 3.1 Update UserInterceptor or Controller
The User entity already has roleAssignments, but need to ensure:
- User is loaded with guardian/staff for profile info
- Transformation maps correctly to response DTO

### 3.2 Add Profile Loading
Update UserInterceptor or create new logic to load:
- Check if user has guardian -> load guardian profile
- Check if user has staff -> load staff profile
- Map to ProfileInfo DTO

**Option A: Update repository findByClerkUid**
```typescript
include: {
  userRoles: { ... },
  guardians: { take: 1 },  // User can have multiple guardians across campuses
  staffs: { take: 1 }
}
```

**Option B: Separate query in interceptor**
Fetch guardian/staff after getting user.

Choose Option A for fewer queries.

---

## Phase 4: Clean Up Deprecated Code

### 4.1 Remove deprecated 'roles' from user.response.ts
- Remove roles?: RoleResponse[] field
- Remove backward-compatible comment
- Keep only roleAssignments

### 4.2 Optimize PermissionsGuard
Since permissions are now loaded with user:
- Remove the re-fetch loop (lines 96-103)
- Use permissions directly from user.roleAssignments
- Performance improvement: N+1 queries eliminated

### 4.3 Search for other deprecated patterns
```bash
grep -r 'roles:' src/infra/http/dtos --include='*.ts'
grep -r 'backward.?compat' src --include='*.ts'
```

---

## Phase 5: Update Tests

### 5.1 Update existing tests
- campus.guard.spec.ts uses roleAssignments (good)
- Check for any tests using deprecated 'roles' pattern

### 5.2 Add/update integration tests
- Test /auth/me returns roleAssignments with permissions
- Test /auth/me returns profile info
- Test permissions are correctly loaded

---

## Phase 6: Verification

### 6.1 Manual testing
1. Login and call GET /auth/me
2. Verify response has roleAssignments (not roles)
3. Verify each role has permissions array populated
4. Verify profile has guardian/staff info

### 6.2 Run all tests
```bash
npm run test
npm run test:e2e
```

---

## Files to Modify (Summary)

1. src/infra/persistence/prisma/repositories/prisma-user.repository.ts
2. src/infra/http/dtos/auth/auth-me.response.ts
3. src/infra/http/dtos/user-management/user/user.response.ts
4. src/infra/http/guards/permissions.guard.ts
5. src/infra/http/interceptors/user.interceptor.ts (or controller)
6. Tests as needed

## Estimated Impact
- Breaking change for frontend (roles -> roleAssignments)
- Performance improvement (fewer DB queries)
- Enterprise-ready RBAC response structure
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation completed on 2026-01-12. All phases implemented successfully with parallel agents. Build and all 358 tests pass.
<!-- SECTION:NOTES:END -->

