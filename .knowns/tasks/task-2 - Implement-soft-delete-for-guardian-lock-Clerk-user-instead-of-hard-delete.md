---
id: '2'
title: Implement soft delete for guardian (lock Clerk user instead of hard delete)
status: done
priority: high
labels:
  - guardian
  - soft-delete
  - clerk
createdAt: '2026-01-05T00:03:18.926Z'
updatedAt: '2026-01-05T00:26:50.768Z'
timeSpent: 471
assignee: '@me'
---
# Implement soft delete for guardian (lock Clerk user instead of hard delete)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, when deleting a guardian, it performs a hard delete:
1. Deletes user from Clerk via deleteIdentity()
2. Deletes user record from database
3. Deletes guardian record from database

This should be changed to soft delete:
1. Lock user in Clerk via lockUser() - prevents login but preserves account
2. Deactivate user in database (isActive = false)
3. Archive guardian in database (isArchived = true)

This allows for potential account recovery and maintains data integrity.

**Endpoint Changes:**
- DELETE /api/guardians/:id → Soft delete (lock + deactivate + archive)
- DELETE /api/danger/guardians/:id → Hard delete (original behavior, kept for admin use)
- PATCH /api/guardians/:id/restore → Restore archived guardian

**Related patterns:**
- Staff archiving (@doc/patterns/unit-of-work-pattern) already implements similar logic
- Guardian entity already has archive()/restore() methods

**Clerk API Reference:**
- lockUser(): Marks user as locked, prevents sign-in until unlocked (lock duration configurable in Clerk Attack Protection settings, default 1 hour)
- unlockUser(): Removes lock, allows sign-in again

**Note:** Using lock instead of ban because lock is reversible and intended for temporary account suspension.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 IdentityPort has lockIdentity(clerkUid) and unlockIdentity(clerkUid) methods
- [x] #2 IdentityService implements lock/unlock using Clerk SDK lockUser()/unlockUser()
- [x] #3 DeleteGuardianUseCase soft deletes: locks Clerk user, deactivates DB user, archives guardian
- [x] #4 RestoreGuardianUseCase exists: unlocks Clerk user, activates DB user, restores guardian
- [ ] #5 Unit tests cover soft delete and restore flows
- [x] #6 API endpoints work correctly (DELETE archives, new PATCH restore endpoint)
- [x] #7 Hard delete endpoint moved to DELETE /api/danger/guardians/:id
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Extend IdentityPort with Lock/Unlock Methods

1. Add lockIdentity(clerkUid: string): Promise<void> to IdentityPort abstract class
2. Add unlockIdentity(clerkUid: string): Promise<void> to IdentityPort abstract class
3. Implement lockIdentity in IdentityService using clerkClient.users.lockUser()
4. Implement unlockIdentity in IdentityService using clerkClient.users.unlockUser()

Files:
- src/application/ports/identity.port.ts
- src/infra/external-services/clerk/identity.service.ts

## Phase 2: Create ArchiveGuardianUseCase (Soft Delete)

1. Create new ArchiveGuardianUseCase following staff archiving pattern
2. Implement: lockIdentity(), deactivate user (isActive = false), archive guardian (isArchived = true)
3. Use UnitOfWork for atomic transaction

Files:
- src/application/user-management/use-cases/guardian/archive-guardian.use-case.ts (new)
- src/infra/persistence/prisma/unit-of-work/transaction-operations/guardian.transaction-ops.ts

## Phase 3: Create RestoreGuardianUseCase

1. Create new use case following existing patterns (see @doc/patterns/use-case-pattern)
2. Implement restore logic: unlockIdentity(), activate user, restore guardian
3. Use UnitOfWork for atomic transaction
4. Add validation (guardian must exist and be archived)

Files:
- src/application/user-management/use-cases/guardian/restore-guardian.use-case.ts (new)

## Phase 4: Update Guardian Controller (Soft Delete Endpoints)

1. Change DELETE /guardians/:id to use ArchiveGuardianUseCase (soft delete)
2. Add PATCH /guardians/:id/restore endpoint using RestoreGuardianUseCase
3. Update response DTOs as needed

Files:
- src/infra/http/controllers/user-management/guardian.controller.ts

## Phase 5: Create Danger Controller (Hard Delete Endpoint)

1. Create new DangerGuardianController at /api/danger/guardians
2. Move original DeleteGuardianUseCase logic to DELETE /danger/guardians/:id
3. Add appropriate guards/permissions for admin-only access
4. Register in module

Files:
- src/infra/http/controllers/danger/danger-guardian.controller.ts (new)
- src/infra/http/controllers/danger/danger.module.ts (new or existing)

## Phase 6: Update Unit of Work Transaction Operations

1. Add updateGuardian operation to guardian.transaction-ops.ts (if not exists)
2. Ensure updateUser operation exists in user.transaction-ops.ts
3. Register operations in UnitOfWork

Files:
- src/infra/persistence/prisma/unit-of-work/transaction-operations/guardian.transaction-ops.ts
- src/infra/persistence/prisma/unit-of-work/transaction-operations/index.ts

## Phase 7: Unit Tests

1. Test IdentityService.lockIdentity() and unlockIdentity()
2. Test ArchiveGuardianUseCase (soft delete flow)
3. Test RestoreGuardianUseCase (restore flow)
4. Test DeleteGuardianUseCase still works for hard delete
5. Test error handling (guardian not found, already archived, etc.)

Files:
- tests/unit/... (follow existing test patterns)

## Implementation Notes

**Key Pattern Reference:**
The staff archiving pattern in archive-staff.use-case.ts is the primary reference:
- Uses UnitOfWork for atomic operations
- Archives entity AND deactivates linked user in single transaction
- Guardian should follow same pattern

**Endpoint Summary:**
- DELETE /api/guardians/:id → Soft delete (new behavior)
- DELETE /api/danger/guardians/:id → Hard delete (original behavior)
- PATCH /api/guardians/:id/restore → Restore archived guardian

**Clerk API:**
- lockUser(userId): Prevents sign-in (duration configurable in Clerk Attack Protection settings)
- unlockUser(userId): Removes lock, allows sign-in

**Error Handling:**
- Clerk lock/unlock errors should not fail the overall operation (best effort, log errors)
- Follow existing pattern from delete-user.use-case.ts
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Key Pattern Reference:**
The staff archiving pattern in archive-staff.use-case.ts is the primary reference:
- Uses UnitOfWork for atomic operations
- Archives entity AND deactivates linked user in single transaction
- Guardian should follow same pattern

**Clerk API:**
- lockUser(userId): Prevents sign-in (duration configurable in Clerk Attack Protection settings)
- unlockUser(userId): Removes lock, allows sign-in

**Error Handling:**
- Clerk lock/unlock errors should not fail the overall operation (best effort, log errors)
- Follow existing pattern from delete-user.use-case.ts

## Implementation Summary

Implemented soft delete (archive) for guardians following the existing staff archiving pattern.

## Changes Made

### 1. IdentityPort (src/application/ports/identity.port.ts)
- Added `lockIdentity(identityUid: string): Promise<void>`
- Added `unlockIdentity(identityUid: string): Promise<void>`

### 2. IdentityService (src/infra/external-services/clerk/identity.service.ts)
- Implemented `lockIdentity()` using `clerkClient.users.lockUser()`
- Implemented `unlockIdentity()` using `clerkClient.users.unlockUser()`

### 3. ArchiveGuardianUseCase (NEW)
- Locks Clerk user (best effort)
- Archives guardian (isArchived = true)
- Deactivates user (isActive = false)
- Uses UnitOfWork for atomic DB operations

### 4. RestoreGuardianUseCase (NEW)
- Unlocks Clerk user (best effort)
- Restores guardian (isArchived = false)
- Activates user (isActive = true)
- Uses UnitOfWork for atomic DB operations

### 5. GuardianController
- DELETE /guardians/:id now calls ArchiveGuardianUseCase (soft delete)
- Added PATCH /guardians/:id/restore endpoint

### 6. DangerGuardianController (NEW)
- DELETE /danger/guardians/:id for hard delete (original behavior)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| DELETE | /api/guardians/:id | Soft delete (archive) |
| PATCH | /api/guardians/:id/restore | Restore archived guardian |
| DELETE | /api/danger/guardians/:id | Hard delete (permanent) |

## Note on Unit Tests (AC #5)

No testing infrastructure is configured in this project (no Jest/Vitest setup, no tests directory). Unit tests should be added once testing framework is established.
<!-- SECTION:NOTES:END -->

