---
id: '19'
title: 'Phase 4.3: Student Attendance Campus Scoping'
status: todo
priority: medium
labels:
  - domain
  - attendance
  - campus-scoping
  - phase-4
createdAt: '2026-01-06T04:30:59.961Z'
updatedAt: '2026-01-06T04:30:59.961Z'
timeSpent: 0
---
# Phase 4.3: Student Attendance Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add campus scoping to the StudentAttendance model. Note: The attendance domain logic is currently minimal (schema exists but limited use cases).

Depends on @task-8 (Schema), @task-9 (Campus module).
See @doc/migrations/multi-campus-migration for context.

## Current State
- StudentAttendance model exists in Prisma schema
- Limited/no domain entity, repository, or use cases implemented

## Changes Required

### Prisma Schema
- Already includes campus_id in migration task (@task-7)
- Ensure FK and index are properly defined

### Domain Layer (if entity exists or needs creation)
**File**: src/domain/attendance/entities/student-attendance.entity.ts (create if needed)
- Add: campusId property (required)
- Properties: studentId, classId, date, checkinAt, checkoutAt, status, reason, note

### Application Layer (if repository exists or needs creation)
**Port**: attendance.repository.ts (create if needed)
- findByCampusId(campusId, params)
- findByStudent(studentId, dateRange)
- findByClass(classId, date)
- Campus filtering on all queries

### Infrastructure Layer
**Repository**: prisma-student-attendance.repository.ts (update or create)
- Include campus filtering
- Validate student and class belong to same campus

### HTTP Layer (if endpoints exist or need creation)
- Attendance endpoints should be campus-scoped
- DTOs should include campusId

## Validation Rules
- Attendance records must reference student and class from same campus
- campusId must match student's campus
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 StudentAttendance has campusId in schema
- [ ] #2 Attendance entity (if exists) has campusId property
- [ ] #3 Attendance repository (if exists) is campus-aware
- [ ] #4 Attendance queries filtered by campus
- [ ] #5 Student and class validated to be in same campus
- [ ] #6 Mapper handles campusId
- [ ] #7 DTOs include campusId
<!-- AC:END -->

