---
id: h2t9t1
title: 'Phase 5: Update HTTP layer (DTOs and controller)'
status: done
priority: medium
labels:
  - http
  - api
createdAt: '2026-01-12T05:01:24.203Z'
updatedAt: '2026-01-12T19:52:09.027Z'
timeSpent: 251
parent: 8721pv
---
# Phase 5: Update HTTP layer (DTOs and controller)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update API response DTOs and controller for backward compatibility.

Files:
- src/infra/http/dtos/attendance/student-attendance.response.ts
- src/infra/http/dtos/attendance/student-attendance-log.response.ts (optional NEW)
- src/infra/http/dtos/attendance/index.ts
- src/infra/http/controllers/attendance.controller.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Response DTO maintains backward compatibility
- [x] #2 Controller response mappings updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Steps

### 1. Update StudentAttendanceResponse DTO

Key principle: BACKWARD COMPATIBILITY - existing API consumers should not break

Field mappings in toResponse():
- Keep: id, studentId, classId, campusId, date, status, note
- checkinAt → map from firstCheckinAt (KEEP old name in response!)
- checkoutAt → map from lastCheckoutAt (KEEP old name in response!)
- reason → return null (deprecated field)
- Add optional: logs?: StudentAttendanceLogResponse[]
- Add optional: totalMinutesPresent?: number

### 2. Create StudentAttendanceLogResponse DTO (NEW, optional)

File: student-attendance-log.response.ts

Fields:
- id, type, timestamp, method
- deviceId, createdById, note
- imageFileId, createdAt

### 3. Update Controller (attendance.controller.ts)

Response mappings:
- Map domain entity to response DTO correctly
- Handle new fields in toResponse helper

Optional new endpoint:
- GET /attendance/:id/logs → returns logs for a summary

### 4. Update index exports
- dtos/attendance/index.ts: export new DTO if created
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated StudentAttendanceResponse with backward compatibility: checkinAt/checkoutAt map from firstCheckinAt/lastCheckoutAt, reason returns null (deprecated), added totalMinutesPresent and optional logs array. Created StudentAttendanceLogResponse DTO. Added fromDomain() static method for clean mapping. Updated controller to handle new use case return types ({summary, log}) and map to backward-compatible responses. Removed reason field from all request DTOs.
<!-- SECTION:NOTES:END -->

