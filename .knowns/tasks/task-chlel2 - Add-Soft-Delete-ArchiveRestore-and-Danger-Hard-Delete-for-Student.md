---
id: chlel2
title: Add Soft Delete (Archive/Restore) and Danger Hard Delete for Student
status: done
priority: medium
labels:
  - student
  - soft-delete
  - clean-architecture
createdAt: '2026-01-20T08:08:19.614Z'
updatedAt: '2026-01-20T16:04:22.249Z'
timeSpent: 1024
assignee: '@me'
---
# Add Soft Delete (Archive/Restore) and Danger Hard Delete for Student

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, Student only has hard delete functionality exposed via DELETE /students/:id. Guardian and Staff both implement a two-tier delete pattern: (1) Soft Delete (Archive) - marks entity as archived for potential recovery, and (2) Hard Delete (Danger) - permanently removes entity. The Student domain entity already has archive() and restore() methods defined but they are NOT exposed through use cases or controllers. This task aligns Student delete functionality with Guardian and Staff patterns. Note: Unlike Guardian/Staff, Students don't have linked user accounts or Clerk integration, so no user account handling is required.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 ArchiveStudentUseCase implemented - archives student by setting isArchived=true and status=DROPPED, validates campus if campusId provided, returns updated Student entity
- [x] #2 RestoreStudentUseCase implemented - restores archived student by setting isArchived=false and status=ACTIVE, throws BadRequestException if student not archived, validates campus if campusId provided
- [x] #3 StudentController DELETE /students/:id endpoint calls ArchiveStudentUseCase (soft delete) instead of hard delete
- [x] #4 StudentController PATCH /students/:id/restore endpoint added calling RestoreStudentUseCase
- [x] #5 DangerStudentController created with DELETE /danger/students/:id endpoint for hard delete, matching Guardian/Staff danger controller pattern
- [x] #6 ArchiveStudentUseCase, RestoreStudentUseCase registered in user-management.module.ts providers
- [x] #7 Unit tests for ArchiveStudentUseCase covering archive success and campus validation
- [x] #8 Unit tests for RestoreStudentUseCase covering restore success, already-restored error case, and campus validation
- [x] #9 DangerStudentController registered in user-management.module.ts controllers array (matching Guardian/Staff danger controller pattern)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Application Layer (Use Cases)

1. **Create ArchiveStudentUseCase**
   - File: `src/application/user-management/use-cases/student/archive-student.use-case.ts`
   - Inject: StudentRepository only (no User/Clerk handling - students don't have accounts)
   - Pattern: Follow ArchiveGuardianUseCase but simplified (no Clerk lock, no user deactivation)
   - Logic: Find student → validate campus → call student.archive() → save → return entity

2. **Create RestoreStudentUseCase**
   - File: `src/application/user-management/use-cases/student/restore-student.use-case.ts`
   - Inject: StudentRepository only
   - Pattern: Follow RestoreGuardianUseCase but simplified
   - Logic: Find student → validate campus → check isArchived (throw if false) → call student.restore() → save → return entity

### Phase 2: Infrastructure Layer (Controllers)

3. **Update StudentController (soft delete)**
   - File: `src/infra/http/controllers/user-management/student.controller.ts`
   - Change DELETE /students/:id to call ArchiveStudentUseCase instead of DeleteStudentUseCase
   - Add PATCH /students/:id/restore calling RestoreStudentUseCase
   - Update API decorators and response messages

4. **Create DangerStudentController**
   - File: `src/infra/http/controllers/danger/danger-student.controller.ts`
   - Pattern: Follow danger-guardian.controller.ts / danger-staff.controller.ts
   - Endpoint: DELETE /danger/students/:id
   - Inject: DeleteStudentUseCase
   - Add DANGER warning in API documentation

### Phase 3: Module Registration

5. **Update user-management.module.ts**
   - Add ArchiveStudentUseCase to providers
   - Add RestoreStudentUseCase to providers
   - Add DangerStudentController to controllers array

### Phase 4: Testing

6. **Create ArchiveStudentUseCase tests**
   - File: `src/application/user-management/use-cases/student/archive-student.use-case.spec.ts`
   - Test: successful archive, student not found, campus mismatch

7. **Create RestoreStudentUseCase tests**
    - File: `src/application/user-management/use-cases/student/restore-student.use-case.spec.ts`
    - Test: successful restore, student not found, student not archived error, campus mismatch

### Key Files Reference
- Guardian pattern: `src/application/user-management/use-cases/guardian/archive-guardian.use-case.ts`
- Danger controller pattern: `src/infra/http/controllers/danger/danger-guardian.controller.ts`
- Module: `src/infra/http/modules/user-management.module.ts`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Files Created
- `src/application/user-management/use-cases/student/archive-student.use-case.ts` - Soft delete use case
- `src/application/user-management/use-cases/student/restore-student.use-case.ts` - Restore archived student use case
- `src/infra/http/controllers/danger/danger-student.controller.ts` - Hard delete controller
- `src/application/user-management/use-cases/student/archive-student.use-case.spec.ts` - 6 test cases
- `src/application/user-management/use-cases/student/restore-student.use-case.spec.ts` - 5 test cases

### Files Modified
- `src/infra/http/controllers/user-management/student.controller.ts` - Updated DELETE to soft delete, added PATCH restore endpoint
- `src/infra/http/modules/user-management.module.ts` - Registered new use cases and controller

### Key Decisions
1. Students don't have user accounts, so no Clerk/UnitOfWork integration needed (simpler than Guardian/Staff)
2. Student.archive() sets isArchived=true AND status=DROPPED
3. Student.restore() sets isArchived=false AND status=ACTIVE
4. Campus validation is optional (matches Guardian pattern)
5. Corrected AC#7: DangerStudentController registered in user-management.module.ts (not danger.module.ts)

### Testing
- All 11 tests pass
- Build compiles successfully
<!-- SECTION:NOTES:END -->

