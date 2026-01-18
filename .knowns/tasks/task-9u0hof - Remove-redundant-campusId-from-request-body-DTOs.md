---
id: 9u0hof
title: Remove redundant campusId from request body DTOs
status: done
priority: medium
labels:
  - refactor
  - api
  - dto
createdAt: '2026-01-17T17:18:46.968Z'
updatedAt: '2026-01-18T08:06:23.244Z'
timeSpent: 6394
assignee: '@me'
---
# Remove redundant campusId from request body DTOs

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
API consistency improvement: Remove campusId from request body DTOs since it's always overwritten by the x-campus-id header value. This follows enterprise best practices where tenant context comes from authenticated headers/tokens, not request bodies.

**Backend**: 12 DTOs require campusId in the body but controllers override it with the header value, making the body field redundant.

**Frontend**: 24 files (6 feature domains) inject campusId into request bodies via mutation hooks. These need to stop sending campusId in request body.

NOTE: Keep CreateRoleRequest.campusId and UpdateRoleRequest.campusId as-is (optional field for system-wide vs campus-scoped roles).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Update corresponding controllers to not spread campusId from dto
- [x] #2 Keep CreateRoleRequest.campusId as-is (optional field for system-wide vs campus-scoped roles)
- [x] #3 Update API documentation/Swagger to reflect changes
- [x] #4 All existing tests pass after changes
- [x] #5 Manual API testing confirms requests work without body campusId
- [x] #6 Frontend: Remove campusId from 6 service files (grade-level, guardian, student, staff, class, school-year)
- [x] #7 Frontend: Update 12 type definitions to remove campusId from *ServiceInput types
- [x] #8 Frontend: Update 12 mutation hooks to stop injecting campusId into request body
- [x] #9 Backend: Add ReorderPostCategoriesRequest to DTO cleanup (missed in original analysis)
- [x] #10 Remove campusId field from 12 create/reorder request DTOs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Analysis

### Backend (12 DTOs to modify)

| # | DTO File | Module |
|---|----------|--------|
| 1 | create-grade-level.request.ts | class-management |
| 2 | create-school-year.request.ts | class-management |
| 3 | create-class.request.ts | class-management |
| 4 | reorder-grade-levels.request.ts | class-management |
| 5 | create-student.request.ts | user-management/student |
| 6 | create-guardian.request.ts | user-management/guardian |
| 7 | create-staff.request.ts | user-management/staff |
| 8 | create-staff-type.request.ts | user-management/staff-type |
| 9 | create-post.request.ts | post |
| 10 | create-post-category.request.ts | post/category |
| 11 | reorder-post-categories.request.ts | post/category |
| 12 | initiate-upload.request.ts | file |

**Exception (DO NOT MODIFY)**:
- CreateRoleRequest.campusId (optional - null = system-wide)
- UpdateRoleRequest.campusId (optional - null = system-wide)

---

### Frontend (24 files across 6 domains)

#### Grade Levels (4 files)
- src/features/grade-levels/services/grade-level.service.ts
- src/features/grade-levels/types.ts
- src/features/grade-levels/hooks/use-create-grade-level.ts
- src/features/grade-levels/hooks/use-update-grade-level.ts

#### Guardians (4 files)
- src/features/guardians/services/guardian.service.ts
- src/features/guardians/types.ts
- src/features/guardians/hooks/use-create-guardian.ts
- src/features/guardians/hooks/use-update-guardian.ts

#### Students (4 files)
- src/features/students/services/student.service.ts
- src/features/students/types.ts
- src/features/students/hooks/use-create-student.ts
- src/features/students/hooks/use-update-student.ts

#### Staff (4 files)
- src/features/staff/services/staff.service.ts
- src/features/staff/types.ts
- src/features/staff/hooks/use-create-staff.ts
- src/features/staff/hooks/use-update-staff.ts

#### Classes (4 files)
- src/features/classes/services/class.service.ts
- src/features/classes/types.ts
- src/features/classes/hooks/use-create-class.ts
- src/features/classes/hooks/use-update-class.ts

#### School Years (4 files)
- src/features/school-years/services/school-year.service.ts
- src/features/school-years/types.ts
- src/features/school-years/hooks/use-create-school-year.ts
- src/features/school-years/hooks/use-update-school-year.ts

---

## Implementation Steps

### Step 1: Backend DTO Updates (12 files)
For each DTO:
1. Remove campusId property
2. Remove @IsUUID() and @IsNotEmpty() decorators
3. Remove @ApiProperty decorator for campusId
4. Clean up imports

### Step 2: Backend Controller Updates
Controllers already inject campusId from header - verify spread pattern works:
- Pattern: { ...dto, campusId } works because dto no longer has campusId

### Step 3: Frontend Service Updates (6 files)
Remove campusId from request body in service methods:
- Change: post<T>(url, data) where data includes campusId
- To: post<T>(url, dataWithoutCampusId)

### Step 4: Frontend Type Updates (6 files)
Remove campusId from ServiceInput types:
- Change: CreateXServiceInput = CreateXInput & { campusId: string }
- To: CreateXServiceInput = CreateXInput (or remove alias entirely)

### Step 5: Frontend Hook Updates (12 files)
Stop injecting campusId in mutation functions:
- Change: service.create({ ...data, campusId })
- To: service.create(data)

### Step 6: Testing
- Run backend tests: npm run test
- Run frontend tests: npm run test
- Manual API testing to verify

---

## Order of Execution
1. Backend changes first (API becomes more permissive)
2. Frontend changes second (stops sending unnecessary field)
3. Both can be in same PR since backend ignores body campusId anyway
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Backend Changes (12 DTOs)
Removed campusId field from:
1. create-grade-level.request.ts
2. create-school-year.request.ts  
3. reorder-grade-levels.request.ts
4. create-class.request.ts
5. create-student.request.ts
6. create-guardian.request.ts
7. create-staff.request.ts
8. create-staff-type.request.ts
9. create-post.request.ts
10. create-post-category.request.ts
11. reorder-post-categories.request.ts
12. initiate-upload.request.ts

Cleaned up unused imports (IsUUID, IsNotEmpty) from affected files.

Controllers already use `{ ...dto, campusId }` pattern so no changes needed.

### Frontend Changes (18 files across 6 domains)
- Updated 6 type files: Changed ServiceInput types from `& { campusId: string }` to base input type
- Updated 12 mutation hooks: Changed `{ ...data, campusId }` to just `data`
- Updated JSDoc comments to reflect header-based campusId

### Preserved (as required)
- CreateRoleRequest.campusId (optional for system-wide roles)
- UpdateRoleRequest.campusId (optional for system-wide roles)

### Testing
- All 425 backend tests pass
- No new lint errors introduced
<!-- SECTION:NOTES:END -->

