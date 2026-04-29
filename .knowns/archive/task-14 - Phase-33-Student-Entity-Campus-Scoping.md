---
id: '14'
title: 'Phase 3.3: Student Entity Campus Scoping'
status: done
priority: high
labels:
  - domain
  - student
  - campus-scoping
  - code-generator
  - phase-3
createdAt: '2026-01-06T04:29:30.467Z'
updatedAt: '2026-01-07T06:39:14.110Z'
timeSpent: 706
assignee: '@me'
---
# Phase 3.3: Student Entity Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the Student entity and related code for campus scoping. Also update the student code generator to be campus-aware.

Depends on @task-8 (Schema), @task-9 (Campus module).
See @doc/migrations/multi-campus-migration for context.

## Changes Required

### Domain Layer
**File**: src/domain/user-management/entities/student.entity.ts
- Add: campusId property (required)
- Update create() factory to require campusId
- Student codes are now unique per campus

### Application Layer

**Port Update**: src/application/user-management/ports/student.repository.ts
- Add: findByCampusId(campusId, params)
- Update: findByStudentCode to include campusId
- Update: findByEmail to be campus-aware
- Update: findByPhoneNumber to be campus-aware
- Update: findAll to filter by campusId

**Port Update**: src/application/ports/student-code-generator.port.ts
- Change signature: generateNextCode(campusId: string): Promise<string>
- Code sequence is now per campus

**Use Case Updates**:
- create-student.use-case.ts
  - Require campusId
  - Pass campusId to code generator
  - Check uniqueness within campus
  
- get-all-students.use-case.ts
  - Filter by campusId
  
- All other student use cases
  - Add campus verification

### Infrastructure Layer

**Repository**: prisma-student.repository.ts
- Update for campus filtering
- Include campus relation

**Mapper**: prisma-student.mapper.ts
- Add campusId mapping

**Service**: prisma/services/student-code-generator.service.ts
- Update generateNextCode to accept campusId parameter
- Query student_code_sequence with (campus_id, year) composite key
- Upsert with campus_id in where clause

### HTTP Layer

**Controller**: student.controller.ts
- Get campusId from auth context
- Pass campusId to use cases
- Ensure operations are campus-scoped

**DTOs**:
- create-student.request.ts - Add campusId (optional if from context)
- student.response.ts - Add campusId

## Important Notes
- Student codes are unique per campus (different campuses can have same code)
- student_code_sequence table now has composite PK (campus_id, year)
- Each campus maintains its own sequence counter
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Student entity updated with campusId property
- [x] #2 StudentRepository port updated for campus awareness
- [x] #3 StudentCodeGeneratorPort signature updated with campusId
- [x] #4 Prisma repository updated for campus filtering
- [x] #5 Student code generator uses campus-scoped sequences
- [x] #6 Create-student requires and passes campusId
- [x] #7 Get-all-students filters by campus
- [x] #8 Student code uniqueness is campus-scoped
- [x] #9 DTOs updated with campusId
- [x] #10 Tests updated. If  not exists then write unit test.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Domain Layer
1. Update Student entity (src/domain/user-management/entities/student.entity.ts)
   - Add campusId property (required)
   - Update create() factory to require campusId
   - Add validation for campusId

### Phase 2: Application Layer
2. Update StudentRepository port (src/application/user-management/ports/student.repository.ts)
   - Add findByStudentCodeInCampus(campusId, studentCode)
   - Add findByEmailInCampus(campusId, email)
   - Add findByPhoneNumberInCampus(campusId, phoneNumber)
   - Add findByCampusId(campusId)

3. Update StudentCodeGeneratorPort (src/application/ports/student-code-generator.port.ts)
   - Change signature: generateNextCode(campusId: string): Promise<string>

4. Update use cases:
   - create-student.use-case.ts: Require campusId, pass to code generator, campus-scoped uniqueness
   - get-all-students.use-case.ts: Filter by campusId
   - update-student.use-case.ts: Campus-scoped uniqueness checks

### Phase 3: Infrastructure Layer
5. Update PrismaStudentMapper (src/infra/persistence/prisma/mapper/prisma-student.mapper.ts)
   - Add campusId mapping in toDomain, toPrisma, toPrismaUpdate

6. Update PrismaStudentRepository (src/infra/persistence/prisma/repositories/prisma-student.repository.ts)
   - Implement campus-aware query methods
   - Include campus relation
   - Add campusId to allowed filter fields

7. Update StudentCodeGeneratorService (src/infra/persistence/prisma/services/student-code-generator.service.ts)
   - Update generateNextCode to accept campusId
   - Use composite key (campusId, year) for sequence

### Phase 4: HTTP Layer
8. Update DTOs:
   - create-student.request.ts: Add campusId (required)
   - student.response.ts: Add campusId

9. Update StudentController:
   - Pass campusId to use cases

### Phase 5: Tests
10. Write unit tests for Student entity
11. Write unit tests for student use cases
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Implemented campus scoping for Student entity across all layers (domain, application, infrastructure, HTTP).

## Changes

### Domain Layer
- Updated `Student` entity with required `campusId` property
- Updated `UpdateStudentData` type to exclude `campusId` (immutable)
- Added campus validation in `Student.create()` factory method

### Application Layer
- Updated `StudentRepository` port with campus-aware methods:
  - `findByEmailInCampus(campusId, email)`
  - `findByPhoneNumberInCampus(campusId, phoneNumber)`
  - `findByStudentCodeInCampus(campusId, studentCode)`
  - `findByCampusId(campusId)`
- Updated `StudentCodeGeneratorPort.generateNextCode(campusId)` signature
- Updated `CreateStudentUseCase`:
  - Requires campusId in input
  - Uses campus-scoped uniqueness checks
  - Passes campusId to code generator
- Updated `GetAllStudentsUseCase`:
  - Requires campusId in input
  - Injects campus filter for scoping
- Updated `UpdateStudentUseCase`:
  - Uses campus-scoped uniqueness checks

### Infrastructure Layer
- Updated `PrismaStudentMapper` to map campusId
- Updated `PrismaStudentRepository` with campus-aware query methods
- Updated `StudentCodeGeneratorService` to use campus-scoped sequences (composite key: campusId + year)

### HTTP Layer
- Updated `CreateStudentRequest` DTO with required campusId field
- Updated `StudentResponse` DTO to include campusId
- Updated `StudentController`:
  - findAll now requires campusId query parameter
  - create passes campusId from request body

## Tests
- Added 35 unit tests for Student entity covering:
  - Creation with required/optional fields
  - Validation (campusId, fullName, email)
  - Profile updates
  - Archive/restore functionality
  - Campus isolation behavior

## Notes
- Student codes are now unique per campus (same code can exist in different campuses)
- Email/phone uniqueness is checked within campus scope
- Seed files need separate update (out of scope for this task)
<!-- SECTION:NOTES:END -->

