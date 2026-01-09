---
id: '15'
title: 'Phase 3.4: Academic Entities Campus Scoping (GradeLevel, Subject, SchoolYear)'
status: done
priority: high
labels:
  - domain
  - academic
  - campus-scoping
  - phase-3
createdAt: '2026-01-06T04:29:49.305Z'
updatedAt: '2026-01-07T06:58:22.754Z'
timeSpent: 643
assignee: '@me'
---
# Phase 3.4: Academic Entities Campus Scoping (GradeLevel, Subject, SchoolYear)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update GradeLevel, Subject, and SchoolYear entities for campus scoping.

Depends on @task-8 (Schema), @task-9 (Campus module).
See @doc/migrations/multi-campus-migration for context.

## GradeLevel Changes

### Domain Layer
**File**: src/domain/class-management/entities/grade-level.entity.ts
- Add: campusId property (required)
- Update create() factory

### Application Layer
**Port**: grade-level.repository.ts
- Add campus-aware methods
- Update findByName to include campusId
- Name + order uniqueness per campus

**Use Cases**:
- create-grade-level.use-case.ts - Require campusId
- reorder-grade-levels.use-case.ts - Scope to campus
- get-all-grade-levels.use-case.ts - Filter by campus

### Infrastructure Layer
- prisma-grade-level.repository.ts - Campus filtering
- prisma-grade-level.mapper.ts - Add campusId

### HTTP Layer
- DTOs: Add campusId to request/response

---

## Subject Changes

### Domain Layer
**File**: src/domain/class-management/entities/subject.entity.ts
- Add: campusId property (required)

### Application Layer
**Port**: subject.repository.ts
- Campus-aware methods
- Name uniqueness per campus

**Use Cases**: Update all for campus context

### Infrastructure Layer
- prisma-subject.repository.ts - Campus filtering
- prisma-subject.mapper.ts - Add campusId

### HTTP Layer
- DTOs: Add campusId

---

## SchoolYear Changes

### Domain Layer
**File**: src/domain/class-management/entities/school-year.entity.ts
- Add: campusId property (required)

### Application Layer
**Port**: school-year.repository.ts
- Campus-aware methods
- Name uniqueness per campus

**Use Cases**: Update all for campus context

### Infrastructure Layer
- prisma-school-year.repository.ts - Campus filtering
- prisma-school-year.mapper.ts - Add campusId

### HTTP Layer
- DTOs: Add campusId

---

## Controller Updates
**File**: reference-data.controller.ts
- All endpoints scoped to campus
- Get campusId from context
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GradeLevel entity has campusId property
- [x] #2 GradeLevel name/order unique per campus
- [x] #3 GradeLevel repository campus-aware
- [x] #4 GradeLevel use cases require campusId
- [x] #5 Subject entity has campusId property
- [x] #6 Subject name unique per campus
- [x] #7 Subject repository campus-aware
- [x] #8 SchoolYear entity has campusId property
- [x] #9 SchoolYear name unique per campus
- [x] #10 SchoolYear repository campus-aware
- [x] #11 Reference data controller scoped to campus
- [x] #12 All mappers updated with campusId
- [x] #13 All DTOs updated with campusId
- [x] #14 Add/ update tests if needed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

Based on thorough code analysis, here's the detailed implementation:

### Phase 1: Domain Layer (Entities)
1.1. **GradeLevel Entity** (grade-level.entity.ts)
   - Add `campusId: string` to props interface
   - Add getter for campusId
   - Update create() factory to require campusId

1.2. **Subject Entity** (subject.entity.ts)
   - Add `campusId: string` to props interface
   - Add getter for campusId  
   - Update create() factory to require campusId

1.3. **SchoolYear Entity** (school-year.entity.ts)
   - Add `campusId: string` to props interface
   - Add getter for campusId
   - Update create() factory to require campusId

### Phase 2: Application Layer (Repository Ports)
2.1. **GradeLevelRepository** (grade-level.repository.ts)
   - Replace `findByName(name)` → `findByNameAndCampus(name, campusId)`
   - Replace `findByOrder(order)` → `findByOrderAndCampus(order, campusId)`
   - Update `findAll/findNonArchived/findAllPaginated` to require campusId
   - Replace `getMaxOrder()` → `getMaxOrderByCampus(campusId)`
   - Update `reorder()` to require campusId

2.2. **SubjectRepository** (subject.repository.ts)
   - Replace `findByName(name)` → `findByNameAndCampus(name, campusId)`
   - Update `findAll()` to require campusId

2.3. **SchoolYearRepository** (school-year.repository.ts)
   - Replace `findByName(name)` → `findByNameAndCampus(name, campusId)`
   - Update `findNonArchived/findAll` to require campusId

### Phase 3: Application Layer (Use Cases)
3.1. **GradeLevel Use Cases**
   - create-grade-level: Require campusId, use for uniqueness checks
   - update-grade-level: Use campusId for uniqueness checks
   - get-all-grade-levels: Add campusId filtering
   - reorder-grade-levels: Scope to campusId
   - delete-grade-level: No change needed (already fetches by ID)

3.2. **SchoolYear Use Cases**
   - create-school-year: Require campusId, use for uniqueness
   - update-school-year: Use campusId for uniqueness
   - get-all-school-years: Add campusId filtering
   - delete-school-year: No change needed

3.3. **Subject Use Cases**
   - get-all-subjects: Add campusId filtering
   - Note: Create/Update/Delete use cases don't exist (out of scope)

### Phase 4: Infrastructure Layer (Mappers)
4.1. **PrismaGradeLevelMapper** - Add campusId to all mapping methods
4.2. **PrismaSubjectMapper** - Add campusId to all mapping methods
4.3. **PrismaSchoolYearMapper** - Add campusId to all mapping methods

### Phase 5: Infrastructure Layer (Repositories)
5.1. **PrismaGradeLevelRepository**
   - Update all methods with campus filtering
   - Reorder: scope to campus

5.2. **PrismaSubjectRepository**
   - Update all methods with campus filtering

5.3. **PrismaSchoolYearRepository**
   - Update all methods with campus filtering

### Phase 6: HTTP Layer (DTOs)
6.1. Request DTOs:
   - CreateGradeLevelRequest: Add campusId (required, UUID)
   - CreateSchoolYearRequest: Add campusId (required, UUID)
   - (Subject has no create DTO)

6.2. Response DTOs:
   - GradeLevelResponse: Add campusId
   - SchoolYearResponse: Add campusId
   - SubjectResponse: Add campusId

### Phase 7: HTTP Layer (Controller)
7.1. **ReferenceDataController**
   - Update all endpoints to receive campusId from request body
   - Pass campusId to use cases
   - For GET endpoints: accept campusId as query param

### Phase 8: Testing
8.1. Update unit tests for entities (if they exist)
8.2. Verify build passes
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Updated GradeLevel, Subject, and SchoolYear entities for campus scoping. All three academic entities now have campusId property and all queries/operations are campus-scoped.

## Changes Made

### Domain Layer
- **GradeLevel Entity**: Added `campusId` property to props, getter, and factory method validation
- **Subject Entity**: Added `campusId` property to props, getter, and factory method validation
- **SchoolYear Entity**: Added `campusId` property to props, getter, and factory method validation

### Application Layer - Repository Ports
- **GradeLevelRepository**: Updated to use campus-aware methods (`findByNameAndCampus`, `findByOrderAndCampus`, `findAll(campusId)`, `getMaxOrder(campusId)`, `reorder(campusId, ids)`)
- **SubjectRepository**: Updated with `findByNameAndCampus` and `findAll(campusId)`
- **SchoolYearRepository**: Updated with `findByNameAndCampus`, `findNonArchived(campusId)`, `findAll(campusId, params)`

### Application Layer - Use Cases
- **GradeLevel**: Updated create, update, get-all, and reorder use cases for campus context
- **SchoolYear**: Updated create, update, and get-all use cases for campus context
- **Subject**: Updated get-all use case for campus context

### Infrastructure Layer - Mappers
- **PrismaGradeLevelMapper**: Added campusId to toDomain, toDomainWithClasses, and toPrisma methods
- **PrismaSubjectMapper**: Added campusId to toDomain and toPrisma methods
- **PrismaSchoolYearMapper**: Added campusId to toDomain and toPrisma methods

### Infrastructure Layer - Repositories
- **PrismaGradeLevelRepository**: All queries now filter by campusId, reorder scopes to campus
- **PrismaSubjectRepository**: All queries now filter by campusId
- **PrismaSchoolYearRepository**: All queries now filter by campusId

### HTTP Layer - DTOs
- **CreateGradeLevelRequest**: Added required campusId field
- **ReorderGradeLevelsRequest**: Added required campusId field
- **CreateSchoolYearRequest**: Added required campusId field
- **GradeLevelResponse**: Added campusId field
- **SchoolYearResponse**: Added campusId field
- **SubjectResponse**: Added campusId field

### HTTP Layer - Controller
- **ReferenceDataController**: All GET endpoints now require campusId query parameter

## Build Status
All task 15 files compile correctly. Pre-existing build errors in other files (Post, File, Role mappers/repositories, seed files) are out of scope for this task - they require separate campus scoping tasks.

## Files Modified (21 files)
- src/domain/class-management/entities/grade-level.entity.ts
- src/domain/class-management/entities/subject.entity.ts
- src/domain/class-management/entities/school-year.entity.ts
- src/application/class-management/ports/grade-level.repository.ts
- src/application/class-management/ports/subject.repository.ts
- src/application/class-management/ports/school-year.repository.ts
- src/application/class-management/use-cases/grade-level/create-grade-level.use-case.ts
- src/application/class-management/use-cases/grade-level/update-grade-level.use-case.ts
- src/application/class-management/use-cases/grade-level/reorder-grade-levels.use-case.ts
- src/application/class-management/use-cases/reference-data/get-all-grade-levels.use-case.ts
- src/application/class-management/use-cases/school-year/create-school-year.use-case.ts
- src/application/class-management/use-cases/school-year/update-school-year.use-case.ts
- src/application/class-management/use-cases/reference-data/get-all-school-years.use-case.ts
- src/application/class-management/use-cases/reference-data/get-all-subjects.use-case.ts
- src/infra/persistence/prisma/mapper/prisma-grade-level.mapper.ts
- src/infra/persistence/prisma/mapper/prisma-subject.mapper.ts
- src/infra/persistence/prisma/mapper/prisma-school-year.mapper.ts
- src/infra/persistence/prisma/repositories/prisma-grade-level.repository.ts
- src/infra/persistence/prisma/repositories/prisma-subject.repository.ts
- src/infra/persistence/prisma/repositories/prisma-school-year.repository.ts
- src/infra/http/dtos/class-management/create-grade-level.request.ts
- src/infra/http/dtos/class-management/reorder-grade-levels.request.ts
- src/infra/http/dtos/class-management/create-school-year.request.ts
- src/infra/http/dtos/class-management/class.response.ts
- src/infra/http/controllers/class-management/reference-data.controller.ts
<!-- SECTION:NOTES:END -->

