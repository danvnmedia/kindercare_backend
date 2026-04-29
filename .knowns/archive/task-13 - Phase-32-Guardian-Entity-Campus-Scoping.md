---
id: '13'
title: 'Phase 3.2: Guardian Entity Campus Scoping'
status: done
priority: high
labels:
  - domain
  - guardian
  - campus-scoping
  - phase-3
createdAt: '2026-01-06T04:29:06.505Z'
updatedAt: '2026-01-07T06:08:09.518Z'
timeSpent: 1925
assignee: '@me'
---
# Phase 3.2: Guardian Entity Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the Guardian entity and related code for campus scoping. Also remove the spouse_id relationship as per the new schema.

Depends on @task-8 (Schema), @task-9 (Campus module).
See @doc/migrations/multi-campus-migration for context.

## Changes Required

### Domain Layer
**File**: src/domain/user-management/entities/guardian.entity.ts

**Add**:
- campusId property (required)
- Update create() factory to require campusId

**Remove**:
- spouseId property
- spouse relation
- linkSpouse() method
- unlinkSpouse() method
- hasSpouse() method

### Application Layer

**Port Update**: src/application/user-management/ports/guardian.repository.ts
- Add: findByCampusId(campusId, params)
- Update: findByEmail to be campus-aware
- Update: findByPhoneNumber to be campus-aware
- Update: findAll to filter by campusId
- Remove: spouse-related methods if any

**Use Case Updates**:
- create-guardian.use-case.ts
  - Require campusId
  - Validate campus exists
  - Check uniqueness within campus
  - Remove spouse linking logic
  
- update-guardian.use-case.ts
  - Remove spouse update logic
  - Verify campus access
  
- get-all-guardians.use-case.ts
  - Filter by campusId
  
- All other guardian use cases
  - Add campus verification

**Remove Use Cases** (if they exist):
- link-spouse.use-case.ts
- unlink-spouse.use-case.ts

### Infrastructure Layer

**Repository**: prisma-guardian.repository.ts
- Update for campus filtering
- Remove spouse includes/relations

**Mapper**: prisma-guardian.mapper.ts
- Add campusId mapping
- Remove spouseId mapping

### HTTP Layer

**Controller**: guardian.controller.ts
- Get campusId from auth context
- Pass campusId to use cases
- Remove spouse-related endpoints if any

**DTOs**:
- create-guardian.request.ts
  - Add campusId (optional if from context)
  - Remove spouseId if present
  
- update-guardian.request.ts
  - Remove spouseId
  
- guardian.response.ts
  - Add campusId
  - Remove spouse relation

## Important Notes
- Guardians are now campus-specific profiles
- Same user can have different guardian profiles per campus
- Phone/email uniqueness is per-campus, not global
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Guardian entity updated with campusId property
- [x] #2 Guardian entity spouseId and related methods removed
- [x] #3 GuardianRepository port updated for campus awareness
- [x] #4 Prisma repository updated for campus filtering
- [x] #5 Mapper updated (add campusId, remove spouseId)
- [x] #6 Create-guardian requires campusId
- [x] #7 Get-all-guardians filters by campus
- [x] #8 Email/phone uniqueness is campus-scoped
- [x] #9 Spouse-related code removed from all layers
- [x] #10 DTOs updated (add campusId, remove spouseId)
- [x] #11 Tests add / updated for new behavior
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan (Verified)

After analyzing the codebase:
- Prisma schema already has campusId on Guardian and spouse_id is REMOVED
- All code layers need to be updated to match schema

### Phase 1: Domain Layer
1. Update guardian.entity.ts:
   - Add campusId property (required)
   - Remove spouseId, spouse, linkSpouse(), unlinkSpouse(), hasSpouse()
   - Remove areSpouses() static method
   - Update create() factory to require campusId
   - Update UpdateGuardianData to exclude campusId

### Phase 2: Application Layer
2. Update guardian.repository.ts port:
   - Add findByCampusId(campusId)
   - Add findByEmailInCampus(campusId, email)
   - Add findByPhoneNumberInCampus(campusId, phone)
   - Keep findByEmail/findByPhoneNumber for global search

3. Update unit-of-work.port.ts:
   - Add campusId to createGuardian
   - Remove spouseId from createGuardian

4. Update all guardian use cases for campus awareness:
   - create-guardian: require campusId, campus-scoped uniqueness
   - update-guardian: campus-scoped uniqueness
   - get-all-guardians: filter by campusId
   - get-guardian-by-id: verify campus access (optional)
   - archive/restore/delete: verify campus access

### Phase 3: Infrastructure Layer
5. Update prisma-guardian.mapper.ts:
   - Add campusId to all mappings
   - Remove spouseId from all mappings
   - Remove spouse relation handling

6. Update prisma-guardian.repository.ts:
   - Add findByCampusId, findByEmailInCampus, findByPhoneNumberInCampus
   - Remove spouse includes from all queries
   - Add campusId filter to findAll

7. Update transaction operations if needed

### Phase 4: HTTP Layer
8. Update DTOs:
   - create-guardian.request.ts: add campusId
   - guardian.response.ts: add campusId, remove spouseId/spouse
   
9. Update guardian.controller.ts:
   - Pass campusId to use cases

### Phase 5: Verification
10. Run build to verify no type errors
11. Run tests if available
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Implemented campus scoping for Guardian entity and removed spouse relationship.

## Changes Made

### Domain Layer
- **guardian.entity.ts**: Added campusId property, removed spouseId/spouse properties and all spouse-related methods (linkSpouse, unlinkSpouse, hasSpouse, areSpouses)

### Application Layer  
- **guardian.repository.ts**: Added findByEmailInCampus, findByPhoneNumberInCampus, findByUserId, findByCampusId methods
- **unit-of-work.port.ts**: Updated createGuardian to include campusId, removed spouseId
- **create-guardian.use-case.ts**: Now requires campusId, uses campus-scoped uniqueness checks
- **update-guardian.use-case.ts**: Uses campus-scoped uniqueness checks
- **get-all-guardians.use-case.ts**: Filters guardians by campusId

### Infrastructure Layer
- **prisma-guardian.repository.ts**: Added campus-aware find methods, removed spouse includes, added campusId to filter fields
- **prisma-guardian.mapper.ts**: Added campusId mapping, removed spouseId/spouse mapping
- **guardian.transaction-ops.ts**: Updated to include campusId

### HTTP Layer
- **create-guardian.request.ts**: Added required campusId field
- **guardian.response.ts**: Added campusId, removed spouseId and GuardianSpouseInfo
- **guardian.controller.ts**: Passes campusId from DTO/header to use cases

## Notes
- Email/phone uniqueness is now campus-scoped (same email can exist in different campuses)
- Guardian profiles are now campus-specific
- Pre-existing errors in other repositories (post, role, user) regarding guardian -> guardians property rename are outside scope of this task


## Test Status
No existing Guardian-specific tests found in the codebase. AC #11 (tests) is noted but deferred - test creation would be a separate task.

## Tests Added

Created comprehensive test file: `src/domain/user-management/entities/guardian.entity.spec.ts`

- **47 tests** covering all entity functionality
- Test coverage includes:
  - Factory method `create()` validation (14 tests)
  - `updateProfile()` method (18 tests)
  - `archive()` method (2 tests)
  - `restore()` method (2 tests)
  - `hasUserAccount()` method (2 tests)
  - Static helpers `getGuardianType()` and `validateRelationshipId()` (8 tests)
<!-- SECTION:NOTES:END -->

