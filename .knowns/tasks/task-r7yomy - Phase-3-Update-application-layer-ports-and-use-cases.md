---
id: r7yomy
title: 'Phase 3: Update application layer (ports and use cases)'
status: done
priority: medium
labels:
  - application
  - use-cases
createdAt: '2026-01-12T05:01:09.323Z'
updatedAt: '2026-01-12T19:45:12.754Z'
timeSpent: 166
parent: 8721pv
---
# Phase 3: Update application layer (ports and use cases)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update repository port interface and all use cases.

Files:
- src/application/attendance/ports/student-attendance.repository.ts
- src/application/attendance/ports/index.ts
- src/application/attendance/use-cases/record-attendance.use-case.ts
- src/application/attendance/use-cases/update-attendance.use-case.ts
- src/application/attendance/use-cases/bulk-record-attendance.use-case.ts
- src/application/attendance/use-cases/get-student-attendance.use-case.ts
- src/application/attendance/use-cases/get-class-attendance.use-case.ts
- src/application/attendance/use-cases/get-attendance-by-id.use-case.ts
- src/application/attendance/use-cases/index.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Repository port updated with log methods
- [x] #2 record-attendance creates summary + log
- [x] #3 update-attendance creates logs on time updates
- [x] #4 bulk-record uses transaction for summary + logs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Steps

### 1. Update Repository Port (student-attendance.repository.ts)

Rename type references: StudentAttendance → StudentAttendanceSummary

Add new methods:
- findLogsBySummaryId(summaryId: string): Promise<StudentAttendanceLog[]>
- saveLog(log: StudentAttendanceLog): Promise<StudentAttendanceLog>
- saveLogs(logs: StudentAttendanceLog[]): Promise<StudentAttendanceLog[]>
- deleteLogsBySummaryId(summaryId: string): Promise<void>

Update existing methods:
- All return types: StudentAttendance → StudentAttendanceSummary

### 2. Update record-attendance.use-case.ts

Current: Creates StudentAttendance
New behavior:
1. Create StudentAttendanceSummary (status, date, etc.)
2. Create StudentAttendanceLog with type=CHECK_IN
3. Set firstCheckinAt from log timestamp
4. Save both in transaction

Add input fields: method?, deviceId?, createdById?

### 3. Update update-attendance.use-case.ts

New behavior:
- When checkinAt changes → create CHECK_IN log
- When checkoutAt changes → create CHECK_OUT log  
- Recalculate cached times (first/last)
- Calculate totalMinutesPresent
- Set updatedById

### 4. Update bulk-record-attendance.use-case.ts

New behavior:
- For each record: create summary + initial CHECK_IN log
- Use transaction for atomicity
- Return created summaries with logs

### 5. Update get-* use cases

Minimal changes - just update type references
- get-attendance-by-id: return StudentAttendanceSummary
- get-class-attendance: return StudentAttendanceSummary[]
- get-student-attendance: return StudentAttendanceSummary[]

### 6. Optional: Add get-attendance-logs.use-case.ts
- Input: summaryId
- Returns: StudentAttendanceLog[]
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated repository port with new methods: findLogsBySummaryId, saveLog, saveLogs, deleteLogsBySummaryId, saveSummaryWithLog, saveManySummariesWithLogs. Updated all 6 use cases: record-attendance creates summary + CHECK_IN log, update-attendance creates logs on time changes and recalculates cached times, bulk-record uses atomic saveManyWithLogs. All type references updated to StudentAttendanceSummary.
<!-- SECTION:NOTES:END -->

