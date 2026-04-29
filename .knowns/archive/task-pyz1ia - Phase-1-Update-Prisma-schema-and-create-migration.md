---
id: pyz1ia
title: 'Phase 1: Update Prisma schema and create migration'
status: done
priority: medium
labels:
  - database
  - prisma
createdAt: '2026-01-12T05:00:53.186Z'
updatedAt: '2026-01-12T19:40:17.446Z'
timeSpent: 246
parent: 8721pv
---
# Phase 1: Update Prisma schema and create migration

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update prisma/schema.prisma with new models and generate database migration.

Files:
- prisma/schema.prisma
- prisma/migrations/[timestamp]_attendance_master_detail/migration.sql
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 StudentAttendanceSummary model created with all fields from dbdiagram
- [x] #2 StudentAttendanceLog model created with all fields from dbdiagram
- [x] #3 Migration generated and handles existing data correctly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Steps

### 1. Update StudentAttendance model → StudentAttendanceSummary
- Rename model: StudentAttendance → StudentAttendanceSummary
- Rename fields: checkinAt → firstCheckinAt, checkoutAt → lastCheckoutAt
- Add new fields: totalMinutesPresent (Int, default 0), updatedById (String?, relation to User)
- Remove field: reason (moved to log)
- Update status enum: add LEFT_EARLY option
- Update table mapping: @@map("student_attendance_summary")
- Update relation name: attendanceSummaries on Student

### 2. Create StudentAttendanceLog model (NEW)
Fields:
- id (uuid, pk)
- attendanceSummaryId (uuid, FK to StudentAttendanceSummary)
- type (String: CHECK_IN, CHECK_OUT)
- timestamp (DateTime)
- method (String: TEACHER_APP, MANUAL_ENTRY)
- deviceId (String?)
- createdById (uuid?, FK to User)
- note (String?)
- imageFileId (uuid?, FK to File)
- createdAt (DateTime)

Indexes: attendanceSummaryId, timestamp, createdById
Relations: attendanceSummary, createdBy (User), imageFile (File)

### 3. Generate migration
- npx prisma migrate dev --name attendance_master_detail
- Include data migration SQL: create initial logs from existing checkin/checkout

### Files to modify:
- prisma/schema.prisma
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Migration created and applied: 20260112193909_attendance_master_detail. Schema changes: StudentAttendance → StudentAttendanceSummary with new fields (firstCheckinAt, lastCheckoutAt, totalMinutesPresent, updatedById). New StudentAttendanceLog model created with all fields from dbdiagram.
<!-- SECTION:NOTES:END -->

