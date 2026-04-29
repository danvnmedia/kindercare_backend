---
id: w1hp6c
title: 'Phase 2: Update domain layer (entities and enums)'
status: done
priority: medium
labels:
  - domain
  - refactor
createdAt: '2026-01-12T05:01:01.339Z'
updatedAt: '2026-01-12T19:42:22.508Z'
timeSpent: 110
parent: 8721pv
---
# Phase 2: Update domain layer (entities and enums)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update domain entities and enums for the new architecture.

Files:
- src/domain/attendance/entities/student-attendance.entity.ts (rename to summary)
- src/domain/attendance/entities/student-attendance-log.entity.ts (NEW)
- src/domain/attendance/entities/index.ts
- src/domain/attendance/enums/attendance-status.enum.ts
- src/domain/attendance/enums/index.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 StudentAttendanceSummary entity created with updated fields
- [x] #2 StudentAttendanceLog entity created
- [x] #3 AttendanceLogType and AttendanceLogMethod enums added
- [x] #4 LEFT_EARLY status added to AttendanceStatus
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Steps

### 1. Create new enums

#### AttendanceLogType (NEW file: attendance-log-type.enum.ts)
- CHECK_IN
- CHECK_OUT

#### AttendanceLogMethod (NEW file: attendance-log-method.enum.ts)
- TEACHER_APP
- MANUAL_ENTRY

#### Update AttendanceStatus (existing file)
- Add: LEFT_EARLY

### 2. Update StudentAttendance entity → StudentAttendanceSummary

File: student-attendance-summary.entity.ts (rename from student-attendance.entity.ts)

Props changes:
- checkinAt → firstCheckinAt
- checkoutAt → lastCheckoutAt
- Add: totalMinutesPresent (number)
- Add: updatedById (string | null)
- Remove: reason

Methods to update:
- checkin() → recordCheckin() - should recalculate cached firstCheckinAt
- checkout() → recordCheckout() - should recalculate cached lastCheckoutAt
- Add: recalculateCachedTimes(logs: StudentAttendanceLog[])
- Add: calculateTotalMinutes()

### 3. Create StudentAttendanceLog entity (NEW)

File: student-attendance-log.entity.ts

Props:
- id, attendanceSummaryId, type (AttendanceLogType)
- timestamp, method (AttendanceLogMethod)
- deviceId, createdById, note, imageFileId
- createdAt

Factory: static create() with validation

### 4. Update index files
- entities/index.ts: export both entities
- enums/index.ts: export new enums
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created: AttendanceLogType (CHECK_IN, CHECK_OUT), AttendanceLogMethod (TEACHER_APP, MANUAL_ENTRY). Updated AttendanceStatus with LEFT_EARLY. Created StudentAttendanceSummary entity with new fields (firstCheckinAt, lastCheckoutAt, totalMinutesPresent, updatedById) and recalculateCachedTimes method. Created StudentAttendanceLog entity. Added backward compatibility alias.
<!-- SECTION:NOTES:END -->

