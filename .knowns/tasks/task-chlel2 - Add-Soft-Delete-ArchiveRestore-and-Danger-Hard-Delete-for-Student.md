---
id: chlel2
title: Add Soft Delete (Archive/Restore) and Danger Hard Delete for Student
status: todo
priority: medium
labels:
  - student
  - soft-delete
  - clean-architecture
createdAt: '2026-01-20T08:08:19.614Z'
updatedAt: '2026-01-20T08:23:10.434Z'
timeSpent: 0
---
# Add Soft Delete (Archive/Restore) and Danger Hard Delete for Student

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, Student only has hard delete functionality exposed via DELETE /students/:id. Guardian and Staff both implement a two-tier delete pattern: (1) Soft Delete (Archive) - marks entity as archived for potential recovery, and (2) Hard Delete (Danger) - permanently removes entity. The Student domain entity already has archive() and restore() methods defined but they are NOT exposed through use cases or controllers. This task aligns Student delete functionality with Guardian and Staff patterns. Note: Unlike Guardian/Staff, Students don't have linked user accounts or Clerk integration, so no user account handling is required.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ArchiveStudentUseCase implemented - archives student by setting isArchived=true and status=DROPPED, validates campus if campusId provided, returns updated Student entity
- [ ] #2 RestoreStudentUseCase implemented - restores archived student by setting isArchived=false and status=ACTIVE, throws BadRequestException if student not archived, validates campus if campusId provided
- [ ] #3 StudentController DELETE /students/:id endpoint calls ArchiveStudentUseCase (soft delete) instead of hard delete
- [ ] #4 StudentController PATCH /students/:id/restore endpoint added calling RestoreStudentUseCase
- [ ] #5 DangerStudentController created with DELETE /danger/students/:id endpoint for hard delete, matching Guardian/Staff danger controller pattern
- [ ] #6 ArchiveStudentUseCase, RestoreStudentUseCase registered in user-management.module.ts providers
- [ ] #7 DangerStudentController added to danger.module.ts controllers array
- [ ] #8 Unit tests for ArchiveStudentUseCase covering archive success and campus validation
- [ ] #9 Unit tests for RestoreStudentUseCase covering restore success, already-restored error case, and campus validation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Application Layer (Use Cases)

1. **Create ArchiveStudentUseCase**
   - File: `src/application/user-management/use-cases/student/archive-student.use-case.ts`
   - Inject: StudentRepository, UnitOfWorkPort (optional, for transaction if needed)
   - Pattern: Follow ArchiveGuardianUseCase/ArchiveStaffUseCase
   - Logic: Find student → validate campus → call student.archive() → save → return entity
   - Note: No Clerk/user account handling needed (students don't have user accounts)

2. **Create RestoreStudentUseCase**
   - File: `src/application/user-management/use-cases/student/restore-student.use-case.ts`
   - Inject: StudentRepository
   - Pattern: Follow RestoreGuardianUseCase/RestoreStaffUseCase
   - Logic: Find student → validate campus → check isArchived (throw if false) → call student.restore() → save → return entity

3. **Add barrel exports**
   - Update `src/application/user-management/use-cases/student/index.ts` with new use cases

### Phase 2: Infrastructure Layer (Controllers)

4. **Update StudentController (soft delete)**
   - File: `src/infra/http/controllers/user-management/student.controller.ts`
   - Change DELETE /students/:id to call ArchiveStudentUseCase instead of DeleteStudentUseCase
   - Add PATCH /students/:id/restore calling RestoreStudentUseCase
   - Update API decorators and response messages

5. **Create DangerStudentController**
   - File: `src/infra/http/controllers/danger/danger-student.controller.ts`
   - Pattern: Follow danger-guardian.controller.ts / danger-staff.controller.ts
   - Endpoint: DELETE /danger/students/:id
   - Inject: DeleteStudentUseCase
   - Add DANGER warning in API documentation

6. **Update barrel exports**
   - Update `src/infra/http/controllers/danger/index.ts` with DangerStudentController

### Phase 3: Module Registration

7. **Update user-management.module.ts**
   - Add ArchiveStudentUseCase to providers
   - Add RestoreStudentUseCase to providers

8. **Update danger.module.ts**
   - Add DangerStudentController to controllers array

### Phase 4: Testing

9. **Create ArchiveStudentUseCase tests**
   - File: `src/application/user-management/use-cases/student/archive-student.use-case.spec.ts`
   - Test: successful archive, student not found, campus mismatch

10. **Create RestoreStudentUseCase tests**
    - File: `src/application/user-management/use-cases/student/restore-student.use-case.spec.ts`
    - Test: successful restore, student not found, student not archived error, campus mismatch

### Key Files Reference
- Guardian pattern: `src/application/user-management/use-cases/guardian/archive-guardian.use-case.ts`
- Staff pattern: `src/application/user-management/use-cases/staff/archive-staff.use-case.ts`
- Danger controller pattern: `src/infra/http/controllers/danger/danger-guardian.controller.ts`
- Module: `src/infra/http/modules/user-management.module.ts`
- Danger module: `src/infra/http/modules/danger.module.ts`
<!-- SECTION:PLAN:END -->

