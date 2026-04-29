---
id: 8721pv
title: Migrate student attendance to master-detail architecture (summary + log)
status: done
priority: high
labels:
  - refactor
  - database
  - attendance
createdAt: '2026-01-12T04:29:12.521Z'
updatedAt: '2026-01-12T19:54:49.791Z'
timeSpent: 0
---
# Migrate student attendance to master-detail architecture (summary + log)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Refactor the attendance system from single table to master-detail architecture as defined in dbdiagram.dbml.

## Schema Changes (from git diff)
**OLD:** `student_attendance` (single table with checkin_at/checkout_at)
**NEW:** 
- `student_attendance_summary` - One record per student per day (master)
- `student_attendance_log` - Multiple check-in/check-out events per day (detail)

## Key Field Changes
- `checkin_at` → `first_checkin_at` (cached from logs)
- `checkout_at` → `last_checkout_at` (cached from logs)
- Added: `total_minutes_present`, `updated_by_id`
- Removed: `reason` field
- New status: `LEFT_EARLY`

## Log Table Fields
- type (CHECK_IN, CHECK_OUT)
- timestamp, method, device_id
- created_by_id, note, image_file_id

Reference: @doc/diagram/dbdiagram.dbml
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prisma schema updated with StudentAttendanceSummary and StudentAttendanceLog models
- [ ] #2 Database migration created and applied successfully
- [ ] #3 Domain entities updated (summary + log)
- [ ] #4 Repository port and implementation updated
- [ ] #5 All use cases updated to work with new architecture
- [ ] #6 API responses remain backward compatible
- [ ] #7 Existing data migrated correctly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Implementation Plan: Attendance Master-Detail Migration

## Phase 1: Schema & Database Layer

### 1.1 Update Prisma Schema (prisma/schema.prisma)
- Rename StudentAttendance model to StudentAttendanceSummary
- Update fields: checkinAt->firstCheckinAt, checkoutAt->lastCheckoutAt
- Add: totalMinutesPresent, updatedById, updatedBy relation
- Remove: reason field
- Add status: LEFT_EARLY
- Create StudentAttendanceLog model (type, timestamp, method, deviceId, createdById, note, imageFileId)

### 1.2 Database Migration
- Generate: npx prisma migrate dev --name attendance_master_detail
- Migrate existing data: create logs from existing checkin/checkout times

## Phase 2: Domain Layer

### 2.1 Enums (src/domain/attendance/enums/)
- Add AttendanceLogType: CHECK_IN, CHECK_OUT
- Add AttendanceLogMethod: TEACHER_APP, MANUAL_ENTRY
- Update AttendanceStatus: add LEFT_EARLY

### 2.2 Entities (src/domain/attendance/entities/)
- Rename StudentAttendance -> StudentAttendanceSummary
- Create StudentAttendanceLog entity (NEW)

## Phase 3: Application Layer

### 3.1 Repository Port
- Add: findLogsBySummaryId(), saveLog(), saveLogs()
- Update return types to Summary entity

### 3.2 Use Cases
- record-attendance: create summary + CHECK_IN log
- update-attendance: create logs on time updates, recalculate cached times
- bulk-record-attendance: transaction with summary + logs
- get-*: query summaries (backward compatible)

## Phase 4: Infrastructure Layer

### 4.1 Mappers
- Rename mapper to PrismaStudentAttendanceSummaryMapper
- Create PrismaStudentAttendanceLogMapper (NEW)

### 4.2 Repository Implementation
- Update prisma.studentAttendance -> prisma.studentAttendanceSummary
- Implement log methods

## Phase 5: HTTP/API Layer

### 5.1 DTOs
- Keep response structure for backward compatibility
- Add optional logs field
- Create StudentAttendanceLogResponse (optional)

### 5.2 Controller
- Update response mappings
- Optional: GET /:summaryId/logs endpoint

## Phase 6: Testing & Validation
- Update unit tests
- Add log creation tests
- Validate data migration

## Files Summary

Critical (14): schema.prisma, entity, enums, repository port, 6 use cases, repository impl, mapper, controller, response DTO

Index files (6): entities/index, enums/index, ports/index, use-cases/index, repositories/index, mapper/index

New files (3): migration.sql, student-attendance-log.entity.ts, prisma-student-attendance-log.mapper.ts

Optional (4): log response DTO, dto index, seed-permissions, dbdiagram (done)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
All 6 phases completed successfully. Migration from single StudentAttendance table to master-detail architecture (StudentAttendanceSummary + StudentAttendanceLog) complete. Backward compatibility maintained.
<!-- SECTION:NOTES:END -->

