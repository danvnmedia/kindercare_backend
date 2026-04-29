---
id: '7'
title: 'Phase 1.3: Update Prisma Schema - Academic & Content Tables Campus Scoping'
status: done
priority: high
labels:
  - migration
  - prisma
  - database
  - phase-1
createdAt: '2026-01-06T04:26:37.740Z'
updatedAt: '2026-01-06T21:43:14.998Z'
timeSpent: 49
assignee: '@me'
---
# Phase 1.3: Update Prisma Schema - Academic & Content Tables Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Prisma schema to add campus_id to all academic and content management tables.

Depends on @task-5 (Campus table must exist first).
See @doc/migrations/multi-campus-migration for context.

## Changes Required

### Academic Tables

**grade_level**
- Add: campus_id (uuid, required, FK to campus)
- Change unique: name -> (campus_id, name)
- Change unique: order -> (campus_id, order)
- Add index on: campus_id

**subject**
- Add: campus_id (uuid, required, FK to campus)
- Change unique: name -> (campus_id, name)
- Add index on: campus_id

**school_year**
- Add: campus_id (uuid, required, FK to campus)
- Change unique: name -> (campus_id, name)
- Add index on: campus_id

**class**
- Add: campus_id (uuid, required, FK to campus)
- Change unique: (schoolYearId, gradeLevelId, name) -> (campus_id, schoolYearId, gradeLevelId, name)
- Add index on: campus_id

**student_attendance**
- Add: campus_id (uuid, required, FK to campus)
- Add index on: campus_id

### Content Tables

**post**
- Add: campus_id (uuid, required, FK to campus)
- Add index on: campus_id

**post_audience**
- Add: campus_id (uuid, required, FK to campus)
- Add index on: campus_id

**file**
- Add: campus_id (uuid, required, FK to campus)
- Add index on: campus_id

## Notes
- Existing data needs default campus_id assigned
- Class uniqueness now includes campus for complete isolation
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 grade_level has campus_id with updated unique constraints
- [x] #2 subject has campus_id with updated unique constraints
- [x] #3 school_year has campus_id with updated unique constraints
- [x] #4 class has campus_id with updated unique constraints
- [x] #5 student_attendance has campus_id with proper FK
- [x] #6 post has campus_id with proper FK
- [x] #7 post_audience has campus_id with proper FK
- [x] #8 file has campus_id with proper FK
- [x] #9 All FKs have proper onDelete behavior
- [x] #10 Prisma schema compiles without errors
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update Campus model - add relations for academic and content tables
2. Update GradeLevel model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Change unique constraints: (campusId, name), (campusId, order)
   - Add index: campusId
3. Update Subject model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Change unique: name -> (campusId, name)
   - Add index: campusId
4. Update SchoolYear model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Change unique: name -> (campusId, name)
   - Add index: campusId
5. Update Class model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Change unique: (schoolYearId, gradeLevelId, name) -> (campusId, schoolYearId, gradeLevelId, name)
   - Add index: campusId
6. Update StudentAttendance model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Add index: campusId
7. Update Post model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Add index: campusId
8. Update PostAudience model:
   - Add campusId (required FK to Campus, onDelete: Cascade)
   - Add index: campusId
9. Update File model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Add index: campusId
10. Run npx prisma format to validate
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Implemented campus scoping for all academic and content tables.

## Academic Tables Changes

### GradeLevel
- Added campusId (required FK, onDelete: Restrict)
- Changed unique: name -> (campusId, name), order -> (campusId, order)

### Subject
- Added campusId (required FK, onDelete: Restrict)
- Changed unique: name -> (campusId, name)

### SchoolYear
- Added campusId (required FK, onDelete: Restrict)
- Changed unique: name -> (campusId, name)

### Class
- Added campusId (required FK, onDelete: Restrict)
- Changed unique: (schoolYearId, gradeLevelId, name) -> (campusId, schoolYearId, gradeLevelId, name)

### StudentAttendance
- Added campusId (required FK, onDelete: Restrict)
- Added index on campusId

## Content Tables Changes

### Post
- Added campusId (required FK, onDelete: Restrict)
- Added index on campusId

### PostAudience
- Added campusId (required FK, onDelete: Cascade)
- Added index on campusId

### File
- Added campusId (required FK, onDelete: Restrict)
- Added index on campusId

## Campus Model Updates
- Added relations: gradeLevels[], subjects[], schoolYears[], classes[], studentAttendances[], posts[], postAudiences[], files[]

## Notes
- PostHistory and PostHistoryStatus intentionally NOT campus-scoped (inherit via Post)
- Attachment intentionally NOT campus-scoped (inherit via Post/File)
- Schema validates successfully
<!-- SECTION:NOTES:END -->

