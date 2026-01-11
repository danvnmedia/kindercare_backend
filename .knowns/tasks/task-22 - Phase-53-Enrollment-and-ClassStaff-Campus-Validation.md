---
id: '22'
title: 'Phase 5.3: Enrollment and ClassStaff Campus Validation'
status: done
priority: medium
labels:
  - domain
  - enrollment
  - class-staff
  - validation
  - phase-5
createdAt: '2026-01-06T04:36:24.409Z'
updatedAt: '2026-01-11T01:27:34.554Z'
timeSpent: 367
---
# Phase 5.3: Enrollment and ClassStaff Campus Validation

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Enrollment and ClassStaff to validate campus consistency across related entities.

Depends on @task-14 (Student campus), @task-12 (Staff campus), @task-16 (Class campus).
See @doc/migrations/multi-campus-migration for context.

## Enrollment Changes

### Validation Rules
- Student must belong to same campus as Class
- This is enforced by FK constraints, but add domain validation

### Use Case Updates
- enroll-student.use-case.ts
  - Verify student.campusId === class.campusId
  - Return clear error if mismatch
  
- unenroll-student.use-case.ts
  - No special campus changes needed (entities already validated)

### Repository Updates
- Include campus validation in save operations
- Consider adding campus to enrollment queries for performance

## ClassStaff Changes

### Validation Rules
- Staff must belong to same campus as Class
- Subject must belong to same campus as Class

### Use Case Updates
- assign-staff-to-class.use-case.ts
  - Verify staff.campusId === class.campusId
  - Verify subject.campusId === class.campusId
  - Return clear error if mismatch
  
- remove-staff-from-class.use-case.ts
  - No special changes needed

### Repository Updates
- Include campus validation in save operations

## Error Messages
- Provide clear messages for cross-campus assignment attempts
- Example: Cannot enroll student from Campus A into class from Campus B
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Enroll-student validates student and class are in same campus
- [x] #2 Assign-staff-to-class validates staff, subject, and class are in same campus
- [x] #3 Clear error messages for cross-campus attempts
- [x] #4 Unit tests cover cross-campus rejection scenarios
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan for Task 22: Enrollment and ClassStaff Campus Validation

### Analysis Summary

**Current State:**
- EnrollStudentUseCase validates: class exists, student exists, no duplicate enrollment
- AssignStaffToClassUseCase validates: class exists, staff exists, subject exists, no duplicate assignment
- Both use cases lack campus validation between related entities
- Controller endpoints for enrollment/staff lack @RequireCampusAccess decorator
- All required entities (Student, Staff, Class, Subject) already have campusId getters

**Pattern to Follow:**
Based on CreateClassUseCase (task 16), the pattern is:
1. Accept campusId in input
2. Validate class belongs to that campus
3. Validate related entities (student/staff/subject) also belong to that campus
4. Use BadRequestException for cross-campus errors

### Phase 1: Update EnrollStudentUseCase

**File:** src/application/class-management/use-cases/enrollment/enroll-student.use-case.ts

Changes:
1. Add `campusId: string` to EnrollStudentInput interface
2. After fetching class, validate: `class.campusId === input.campusId`
3. After fetching student, validate: `student.campusId === input.campusId`
4. Error: "Cannot enroll student from a different campus into this class"

### Phase 2: Update AssignStaffToClassUseCase

**File:** src/application/class-management/use-cases/class-staff/assign-staff-to-class.use-case.ts

Changes:
1. Add `campusId: string` to AssignStaffToClassInput interface
2. After fetching class, validate: `class.campusId === input.campusId`
3. After fetching staff, validate: `staff.campusId === input.campusId`
4. After fetching subject, validate: `subject.campusId === input.campusId`
5. Errors: "Staff does not belong to this campus", "Subject does not belong to this campus"

### Phase 3: Update Controller Endpoints

**File:** src/infra/http/controllers/class-management/class.controller.ts

Changes:
1. Add @RequireCampusAccess() decorator to:
   - POST /:id/enrollments (enrollStudent)
   - POST /:id/staff (assignStaff)
2. Add @CampusContext() parameter to these methods
3. Pass campusId to use cases
4. Add ApiHeader documentation for X-Campus-Id

### Phase 4: Update DTOs (if needed)

**Files:**
- src/infra/http/dtos/class-management/enroll-student.request.ts
- src/infra/http/dtos/class-management/assign-staff.request.ts (if exists)

Verify DTOs don't need campusId as it comes from header.

### Phase 5: Unit Tests

Write unit tests for:
- EnrollStudentUseCase: cross-campus rejection scenarios
- AssignStaffToClassUseCase: cross-campus rejection scenarios

### Error Messages

| Scenario | HTTP Status | Message |
|----------|-------------|---------|
| Class not in campus | 400 | Class does not belong to this campus |
| Student in different campus | 400 | Cannot enroll student from a different campus into this class |
| Staff in different campus | 400 | Staff does not belong to this campus |
| Subject in different campus | 400 | Subject does not belong to this campus |

### Files to Modify

1. src/application/class-management/use-cases/enrollment/enroll-student.use-case.ts
2. src/application/class-management/use-cases/class-staff/assign-staff-to-class.use-case.ts
3. src/infra/http/controllers/class-management/class.controller.ts

### Files to Create (Tests)

1. src/application/class-management/use-cases/enrollment/enroll-student.use-case.spec.ts
2. src/application/class-management/use-cases/class-staff/assign-staff-to-class.use-case.spec.ts

### Notes

- UnenrollStudentUseCase and RemoveStaffFromClassUseCase don't need campus changes (operates on existing validated entities)
- Repository-level validation not strictly needed (use case validates before save)
- Following existing exception patterns (BadRequestException from @nestjs/common)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Pre-Implementation Analysis (Ultrathink Mode)

**Dependencies Verified:**
- Task 20 (User Roles Campus Scoping): DONE
- Task 21 (Campus Context and Authentication Integration): DONE
- Task 12 (Staff Entity Campus Scoping): DONE
- Task 14 (Student Entity Campus Scoping): DONE
- Task 16 (Class Entity Campus Scoping): DONE

**Blocker Cleared:** Task 21 has been completed, providing @RequireCampusAccess() decorator and @CampusContext() parameter decorator.

**Codebase Analysis:**

1. **EnrollStudentUseCase (enroll-student.use-case.ts:14-94)**
   - Input: classId, studentId, enrollmentDate, note
   - Missing: campusId validation
   - Current flow: validate existence, check duplicates, create enrollment
   - Fix: Add campusId to input, validate student.campusId === class.campusId

2. **AssignStaffToClassUseCase (assign-staff-to-class.use-case.ts:15-101)**
   - Input: classId, staffId, subjectId
   - Missing: campusId validation
   - Current flow: validate existence, check duplicates, create assignment
   - Fix: Add campusId to input, validate all three entities match campus

3. **ClassController (class.controller.ts:158-313)**
   - Enrollment endpoints: POST /:id/enrollments, GET /:id/enrollments, DELETE
   - Staff endpoints: POST /:id/staff, GET /:id/staff, DELETE
   - Missing: @RequireCampusAccess() on POST endpoints
   - Fix: Add decorator, pass campusId from @CampusContext()

**Entities with campusId getter confirmed:**
- Student: src/domain/user-management/entities/student.entity.ts
- Staff: src/domain/user-management/entities/staff.entity.ts
- Class: src/domain/class-management/entities/class.entity.ts
- Subject: src/domain/class-management/entities/subject.entity.ts

**Pattern Reference:**
CreateClassUseCase (create-class.use-case.ts:42-73) demonstrates the campus validation pattern:
\`\`\`typescript
if (gradeLevel.campusId !== input.campusId) {
  throw new BadRequestException(\`Grade level does not belong to the specified campus\`);
}
\`\`\`



### Implementation Completed (2026-01-10)

**Summary:** Implemented campus validation for Enrollment and ClassStaff operations, ensuring entities cannot be associated across different campuses.

## Files Modified

### Application Layer (Use Cases)

**1. enroll-student.use-case.ts**
- Added `campusId: string` to `EnrollStudentInput` interface
- Added Step 1b: Validate class belongs to specified campus
- Added Step 2b: Validate student belongs to same campus as class
- Error: "Cannot enroll student from a different campus into this class"

**2. assign-staff-to-class.use-case.ts**
- Added `campusId: string` to `AssignStaffToClassInput` interface
- Added Step 1b: Validate class belongs to specified campus
- Added Step 2b: Validate staff belongs to same campus
- Added Step 3b: Validate subject belongs to same campus
- Errors: "Staff does not belong to this campus", "Subject does not belong to this campus"

### HTTP Layer (Controller)

**3. class.controller.ts**
- Added `@RequireCampusAccess()` decorator to `POST /:id/enrollments` endpoint
- Added `@RequireCampusAccess()` decorator to `POST /:id/staff` endpoint
- Added `@CampusContext()` parameter decorator to extract campusId from header
- Added `@ApiHeader` documentation for X-Campus-Id header
- Pass campusId from controller to use cases

## Files Created (Tests)

**4. enroll-student.use-case.spec.ts**
- 8 test cases covering:
  - Success: Enroll student with/without note
  - Class not found / Class in different campus
  - Student not found / Student in different campus
  - Duplicate enrollment / Allow different dates

**5. assign-staff-to-class.use-case.spec.ts**
- 8 test cases covering:
  - Success: Assign staff to class
  - Class not found / Class in different campus
  - Staff not found / Staff in different campus
  - Subject not found / Subject in different campus
  - Duplicate assignment

## API Changes

Endpoints now require `X-Campus-Id` header:
- `POST /classes/:id/enrollments` - Enroll student
- `POST /classes/:id/staff` - Assign staff

## Validation Flow

```
1. Extract campusId from X-Campus-Id header via CampusGuard
2. CampusGuard validates: campus exists, active, user has access
3. Use case validates: class, student/staff, subject belong to same campus
4. If any validation fails, BadRequestException with clear message
```

## Test Results
- 16 tests: 16 passed
- Build: Successful (tsc --noEmit)
<!-- SECTION:NOTES:END -->

