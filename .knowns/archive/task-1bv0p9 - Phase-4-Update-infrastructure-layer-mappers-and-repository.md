---
id: 1bv0p9
title: 'Phase 4: Update infrastructure layer (mappers and repository)'
status: done
priority: medium
labels:
  - infrastructure
  - prisma
createdAt: '2026-01-12T05:01:16.956Z'
updatedAt: '2026-01-12T19:47:54.174Z'
timeSpent: 157
parent: 8721pv
---
# Phase 4: Update infrastructure layer (mappers and repository)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Prisma mappers and repository implementation.

Files:
- src/infra/persistence/prisma/mapper/prisma-student-attendance.mapper.ts
- src/infra/persistence/prisma/mapper/prisma-student-attendance-log.mapper.ts (NEW)
- src/infra/persistence/prisma/mapper/index.ts
- src/infra/persistence/prisma/repositories/prisma-student-attendance.repository.ts
- src/infra/persistence/prisma/repositories/index.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Summary mapper updated with renamed fields
- [x] #2 Log mapper created
- [x] #3 Repository uses studentAttendanceSummary table
- [x] #4 Log methods implemented in repository
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Steps

### 1. Update PrismaStudentAttendanceMapper → PrismaStudentAttendanceSummaryMapper

File: prisma-student-attendance-summary.mapper.ts (rename)

Field mappings:
- checkinAt → firstCheckinAt
- checkoutAt → lastCheckoutAt  
- Add: totalMinutesPresent
- Add: updatedById, updatedBy relation
- Remove: reason

Methods:
- toDomain(prisma): maps all fields including relations
- toDomainSimple(prisma): without relations
- toPrisma(entity): for create operations
- toPrismaUpdate(entity): for update operations

### 2. Create PrismaStudentAttendanceLogMapper (NEW)

File: prisma-student-attendance-log.mapper.ts

Methods:
- toDomain(prismaLog): StudentAttendanceLog entity
- toPrisma(log): Prisma create input
- toDomainArray(prismaLogs): StudentAttendanceLog[]

### 3. Update Repository (prisma-student-attendance.repository.ts)

Table reference: prisma.studentAttendance → prisma.studentAttendanceSummary

Update all existing methods to use new table/mapper

Implement new log methods:
- findLogsBySummaryId: query studentAttendanceLog by summaryId
- saveLog: create single log record
- saveLogs: create multiple logs in transaction
- deleteLogsBySummaryId: delete all logs for summary

### 4. Update index files
- mapper/index.ts: export both mappers
- repositories/index.ts: update export if needed
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created PrismaStudentAttendanceSummaryMapper with toDomain, toDomainSimple, toPrisma, toPrismaUpdate, toDomainArray. Created PrismaStudentAttendanceLogMapper with toDomain, toPrisma, toDomainArray. Updated repository to use studentAttendanceSummary table. Implemented all log methods: findLogsBySummaryId, saveLog, saveLogs, deleteLogsBySummaryId, saveSummaryWithLog, saveManySummariesWithLogs with transaction support.
<!-- SECTION:NOTES:END -->

