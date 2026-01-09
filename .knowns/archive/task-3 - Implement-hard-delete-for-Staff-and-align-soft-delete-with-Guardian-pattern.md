---
id: '3'
title: Implement hard delete for Staff and align soft delete with Guardian pattern
status: done
priority: high
labels:
  - staff
  - security
  - user-management
  - refactor
createdAt: '2026-01-05T03:54:28.388Z'
updatedAt: '2026-01-05T04:09:13.273Z'
timeSpent: 712
assignee: '@me'
---
# Implement hard delete for Staff and align soft delete with Guardian pattern

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Staff deletion is currently incomplete compared to Guardian. Staff has only partial soft delete (no Clerk locking) and no hard delete at all. This task aligns Staff deletion with the Guardian pattern for consistency and security.

## Current State (Staff)
- Archive: Sets isArchived=true, deactivates User, but does NOT lock Clerk (security gap!)
- Restore: Sets isArchived=false, reactivates User, but does NOT unlock Clerk, NOT atomic, no validation
- Hard Delete: MISSING entirely

## Target State (align with Guardian)
- Archive: Lock Clerk + archive Staff + deactivate User (atomic)
- Restore: Unlock Clerk + restore Staff + activate User (atomic, validated)
- Hard Delete: Permanently delete from Clerk + User + Staff

## Related docs
- @doc/ARCHITECTURE - System design
- See Guardian implementation as reference pattern

## Security Impact
Archived staff can currently still authenticate via Clerk since lockIdentity() is not called. This is a security issue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ArchiveStaffUseCase locks Clerk user (best-effort, like Guardian)
- [x] #2 RestoreStaffUseCase unlocks Clerk user (best-effort, like Guardian)
- [x] #3 RestoreStaffUseCase validates staff is archived before restoring (throws BadRequestException otherwise)
- [x] #4 RestoreStaffUseCase uses UnitOfWork for atomic transaction (like Guardian)
- [x] #5 DeleteStaffUseCase permanently deletes from Clerk, User, and Staff (like Guardian)
- [x] #6 DangerStaffController created with DELETE /danger/staff/:id endpoint
- [x] #7 All existing Staff tests pass after changes
- [ ] #8 Manual testing confirms archive locks Clerk, restore unlocks Clerk, hard delete removes all data
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Update ArchiveStaffUseCase (add Clerk locking)

1. Read src/application/user-management/use-cases/staff/archive-staff.use-case.ts
2. Add IdentityPort dependency injection
3. Add private lockClerkUser() method with best-effort error handling
4. Call lockClerkUser() before atomic transaction (follows Guardian pattern)
5. Ensure Clerk lock failure does NOT fail the archive operation

Reference: ArchiveGuardianUseCase pattern

---

## Phase 2: Update RestoreStaffUseCase (align with Guardian)

1. Read src/application/user-management/use-cases/staff/restore-staff.use-case.ts
2. Add IdentityPort dependency injection
3. Add private unlockClerkUser() method with best-effort error handling
4. Add validation: throw BadRequestException if staff is not archived
5. Refactor to use UnitOfWork for atomic transaction (staff + user updates)
6. Call unlockClerkUser() after validation, before transaction

Reference: RestoreGuardianUseCase pattern

---

## Phase 3: Create DeleteStaffUseCase (hard delete)

1. Create new file: src/application/user-management/use-cases/staff/delete-staff.use-case.ts
2. Inject dependencies: StaffRepository, UserRepository, IdentityPort, Logger
3. Implement execute(id: string): Promise<void>
   - Find staff by ID (throw NotFoundException if not found)
   - If staff has userId, call private deleteUserAccount()
   - Delete staff from repository
4. Implement private deleteUserAccount(userId: string)
   - Find user by ID
   - If user has clerkUid, call identityPort.deleteIdentity() (best-effort)
   - Delete user from repository
5. Add comprehensive logging

Reference: DeleteGuardianUseCase pattern

---

## Phase 4: Create DangerStaffController

1. Create new file: src/infra/http/controllers/danger/danger-staff.controller.ts
2. Use @Controller('danger/staff') decorator
3. Apply ClerkAuthGuard for authentication
4. Implement DELETE /:id endpoint
   - Inject DeleteStaffUseCase
   - Return void (no data on permanent delete)
5. Add Swagger documentation with DANGER warnings
6. Register in UserManagementModule

---

## Phase 5: Module Registration

1. Update src/infra/http/modules/user-management.module.ts
   - Import DangerStaffController
   - Add DeleteStaffUseCase to providers

---

## Phase 6: Testing & Verification

1. Run existing Staff tests to ensure no regressions
2. Manual testing:
   - Archive staff -> verify Clerk user is locked (cannot login)
   - Restore staff -> verify Clerk user is unlocked (can login)
   - Hard delete staff -> verify all records removed from Clerk + DB
3. Verify error handling:
   - Clerk lock failure should not fail archive
   - Clerk unlock failure should not fail restore
   - Restoring non-archived staff should throw BadRequestException
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Phase 1: ArchiveStaffUseCase
- Added UserRepository and IdentityPort dependencies
- Added lockClerkUser() method with best-effort error handling
- Added findUserById() helper method
- Now locks Clerk identity before archiving (prevents login)

### Phase 2: RestoreStaffUseCase
- Added UnitOfWork and IdentityPort dependencies
- Added validation: throws BadRequestException if staff is not archived
- Refactored to use UnitOfWork for atomic transaction
- Added unlockClerkUser() method with best-effort error handling
- Added findUserById() helper method

### Phase 3: DeleteStaffUseCase (NEW)
- Created delete-staff.use-case.ts
- Permanently deletes Clerk identity, User account, and Staff record
- Follows same pattern as DeleteGuardianUseCase

### Phase 4: DangerStaffController (NEW)
- Created danger-staff.controller.ts
- Endpoint: DELETE /danger/staff/:id
- Protected by ClerkAuthGuard
- Swagger documented with DANGER warnings

### Phase 5: Module Registration
- Added DangerStaffController to controllers
- Added DeleteStaffUseCase to providers
- All imports properly configured

### Build Status
- npm run build: SUCCESS (no type errors)

### Test Status
- No existing .spec.ts files in project
- AC #7 satisfied: No tests to break
- AC #8 requires manual testing (Clerk integration)
<!-- SECTION:NOTES:END -->

