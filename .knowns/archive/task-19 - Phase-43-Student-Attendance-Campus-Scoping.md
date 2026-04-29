---
id: '19'
title: 'Phase 4.3: Student Attendance Campus Scoping'
status: done
priority: medium
labels:
  - domain
  - attendance
  - campus-scoping
  - phase-4
createdAt: '2026-01-06T04:30:59.961Z'
updatedAt: '2026-01-11T03:22:37.691Z'
timeSpent: 18
assignee: Claude
---
# Phase 4.3: Student Attendance Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**FULL IMPLEMENTATION TASK** - Create Student Attendance module with campus scoping.

**Current State:**
- Prisma schema has StudentAttendance model with campusId (READY)
- NO domain layer exists (entity + enum needed)
- NO application layer exists (repository port + use cases needed)
- NO infrastructure layer exists (Prisma repository + mapper needed)
- NO HTTP layer exists (controller + DTOs needed)

**Scope:**
This is NOT just a "campus scoping" update - it requires building the entire attendance feature from scratch with campus awareness built in from the start.

**Key Requirements:**
1. Create AttendanceStatus enum (PRESENT, ABSENT, LATE, EXCUSED)
2. Create StudentAttendance domain entity with campusId
3. Create attendance repository port with campus-aware methods
4. Create Prisma mapper (5 methods) and repository implementation
5. Validate student and class belong to same campus
6. Create DTOs with campusId-aware patterns
7. Create HTTP controller with campus-scoped endpoints

**Dependencies:** Tasks 14 (Student), 16 (Class) must be complete.

**Files to Create:**
- src/domain/attendance/entities/student-attendance.entity.ts
- src/domain/attendance/enums/attendance-status.enum.ts
- src/domain/attendance/index.ts
- src/application/attendance/ports/student-attendance.repository.ts
- src/application/attendance/use-cases/record-attendance.use-case.ts
- src/application/attendance/use-cases/update-attendance.use-case.ts
- src/application/attendance/use-cases/get-class-attendance.use-case.ts
- src/application/attendance/use-cases/get-student-attendance.use-case.ts
- src/application/attendance/use-cases/bulk-record-attendance.use-case.ts
- src/infra/persistence/prisma/mapper/prisma-student-attendance.mapper.ts
- src/infra/persistence/prisma/repositories/prisma-student-attendance.repository.ts
- src/infra/http/dtos/attendance/*.ts
- src/infra/http/controllers/attendance.controller.ts
- src/infra/http/modules/attendance.module.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 AttendanceStatus enum created with PRESENT, ABSENT, LATE, EXCUSED
- [x] #2 StudentAttendance entity has campusId property with validation
- [x] #3 StudentAttendance repository port is campus-aware
- [x] #4 PrismaStudentAttendanceMapper has all 5 required methods
- [x] #5 PrismaStudentAttendanceRepository implements port with campus filtering
- [x] #6 RecordAttendance use case validates student/class belong to same campus
- [x] #7 UpdateAttendance use case allows updating status/checkout/notes
- [x] #8 GetClassAttendance use case returns daily attendance for a class
- [x] #9 GetStudentAttendance use case returns student history with date range
- [x] #10 BulkRecordAttendance use case handles multiple students at once
- [x] #11 DTOs include proper validation and Swagger documentation
- [x] #12 AttendanceController uses RequireCampusAccess and CampusContext decorators
- [x] #13 AttendanceModule registered in http.module.ts
- [x] #14 All use cases log operations properly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Domain Layer
1. Create src/domain/attendance/enums/attendance-status.enum.ts
   - Define PRESENT, ABSENT, LATE, EXCUSED statuses
   
2. Create src/domain/attendance/entities/student-attendance.entity.ts
   - Props: studentId, classId, campusId, date, checkinAt, checkoutAt, status, reason, note
   - Getters for all properties
   - Domain methods: checkin(), checkout(), updateStatus()
   - Factory method with validation (require campusId)
   - Optional relations: student, class

3. Create src/domain/attendance/index.ts barrel export

### Phase 2: Application Layer (Repository Port)
4. Create src/application/attendance/ports/student-attendance.repository.ts
   - findById, findByStudentAndDate (unique constraint)
   - findByClassAndDate (for daily class attendance)
   - findByStudentDateRange (student attendance history)
   - findByCampus with pagination
   - save, update, delete methods

### Phase 3: Application Layer (Use Cases)
5. Create record-attendance.use-case.ts
   - Input: campusId, studentId, classId, date, status, checkinAt
   - Validate student exists and belongs to campus
   - Validate class exists and belongs to campus
   - Check for duplicate (unique studentId+date)
   - Create and save attendance record

6. Create update-attendance.use-case.ts
   - Input: attendanceId, checkoutAt?, status?, reason?, note?
   - Validate attendance exists
   - Update fields and persist

7. Create get-class-attendance.use-case.ts
   - Input: campusId, classId, date
   - Validate class belongs to campus
   - Return all attendance records for that class/date

8. Create get-student-attendance.use-case.ts
   - Input: campusId, studentId, startDate, endDate
   - Validate student belongs to campus
   - Return attendance records in date range

9. Create bulk-record-attendance.use-case.ts
   - Input: campusId, classId, date, records[]
   - Validate all students belong to campus
   - Create/update attendance in bulk

### Phase 4: Infrastructure Layer (Persistence)
10. Create prisma-student-attendance.mapper.ts
    - toDomain, toDomainSimple, toPrisma, toPrismaUpdate, toDomainArray

11. Create prisma-student-attendance.repository.ts
    - Implement all port methods
    - Include student and class relations
    - Campus-aware filtering

### Phase 5: Infrastructure Layer (HTTP)
12. Create DTOs in src/infra/http/dtos/attendance/
    - record-attendance.request.ts
    - update-attendance.request.ts
    - bulk-record-attendance.request.ts
    - student-attendance.response.ts
    - index.ts

13. Create attendance.controller.ts
    - POST /attendance - record attendance (requires campus)
    - POST /attendance/bulk - bulk record (requires campus)
    - PATCH /attendance/:id - update attendance
    - GET /classes/:classId/attendance - class daily attendance (requires campus)
    - GET /students/:studentId/attendance - student history (requires campus)

### Phase 6: Module Integration
14. Create src/infra/http/modules/attendance.module.ts
    - Import dependencies (PrismaModule, StandardResponseModule, UserManagementModule, ClassManagementModule)
    - Register all use cases
    - Bind repository port to implementation
    - Export repository for potential use by other modules

15. Register AttendanceModule in http.module.ts

### Testing Considerations
- Student and class must belong to same campus for attendance
- One attendance record per student per date (unique constraint)
- Checkin/checkout times are optional
- Status defaults to PRESENT
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete - 2026-01-10

### Files Created:

**Domain Layer:**
- src/domain/attendance/enums/attendance-status.enum.ts - PRESENT, ABSENT, LATE, EXCUSED
- src/domain/attendance/entities/student-attendance.entity.ts - Entity with campusId property
- src/domain/attendance/index.ts - Barrel export

**Application Layer:**
- src/application/attendance/ports/student-attendance.repository.ts - Campus-aware repository port
- src/application/attendance/use-cases/record-attendance.use-case.ts - Validates student/class belong to same campus
- src/application/attendance/use-cases/update-attendance.use-case.ts - Update status/checkout/notes
- src/application/attendance/use-cases/get-attendance-by-id.use-case.ts
- src/application/attendance/use-cases/get-class-attendance.use-case.ts - Daily attendance for a class
- src/application/attendance/use-cases/get-student-attendance.use-case.ts - Student history with date range
- src/application/attendance/use-cases/bulk-record-attendance.use-case.ts - Multiple students at once
- src/application/attendance/index.ts - Barrel export

**Infrastructure Layer:**
- src/infra/persistence/prisma/mapper/prisma-student-attendance.mapper.ts - All 5 methods
- src/infra/persistence/prisma/repositories/prisma-student-attendance.repository.ts - Campus filtering
- src/infra/http/dtos/attendance/record-attendance.request.ts
- src/infra/http/dtos/attendance/update-attendance.request.ts
- src/infra/http/dtos/attendance/bulk-record-attendance.request.ts
- src/infra/http/dtos/attendance/student-attendance.response.ts
- src/infra/http/dtos/attendance/index.ts
- src/infra/http/controllers/attendance.controller.ts - Uses RequireCampusAccess/CampusContext decorators
- src/infra/http/modules/attendance.module.ts

**Updated Files:**
- src/infra/persistence/prisma/mapper/index.ts
- src/infra/persistence/prisma/repositories/index.ts
- src/infra/http/http.module.ts

### API Endpoints:
- POST /attendance - Record attendance (requires campus)
- POST /attendance/bulk - Bulk record (requires campus)
- GET /attendance/:id - Get by ID
- PATCH /attendance/:id - Update attendance
- GET /attendance/class/:classId?date=YYYY-MM-DD - Class daily attendance (requires campus)
- GET /attendance/student/:studentId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD - Student history (requires campus)

### Build Status:
Attendance module builds successfully. Pre-existing errors in content-management module are unrelated.
<!-- SECTION:NOTES:END -->

