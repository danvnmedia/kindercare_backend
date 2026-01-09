---
id: '6'
title: 'Phase 1.2: Update Prisma Schema - Profile Tables Campus Scoping'
status: done
priority: high
labels:
  - migration
  - prisma
  - database
  - phase-1
createdAt: '2026-01-06T04:26:21.808Z'
updatedAt: '2026-01-06T21:42:47.679Z'
timeSpent: 314
assignee: '@me'
---
# Phase 1.2: Update Prisma Schema - Profile Tables Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Prisma schema to add campus_id to all profile tables (staff, guardian, student) and update their unique constraints.

Depends on @task-5 (Campus table must exist first).
See @doc/migrations/multi-campus-migration for context.

## Changes Required

### staff table
- Add: campus_id (uuid, required, FK to campus)
- Add: staff_type_id (uuid, FK to staff_type, replaces staff_type text field)
- Remove: staff_type (text field - replaced by FK)
- Change unique: email -> (campus_id, email)
- Change unique: phone_number -> (campus_id, phone_number)
- Change unique: user_id -> (campus_id, user_id)
- Add index on: staff_type_id, campus_id

### guardian table
- Add: campus_id (uuid, required, FK to campus)
- Remove: spouse_id (self-referential FK removed)
- Change unique: email -> (campus_id, email)
- Change unique: phone_number -> (campus_id, phone_number)
- Change unique: user_id -> (campus_id, user_id)
- Add index on: campus_id

### student table
- Add: campus_id (uuid, required, FK to campus)
- Change unique: student_code -> (campus_id, student_code)
- Change index: email -> (campus_id, email)
- Change index: phone_number -> (campus_id, phone_number)
- Add index on: campus_id

## Data Migration Considerations
- All existing records need a default campus_id
- staff.staff_type text values need mapping to staff_type table records
- Guardian spouse relationships need alternative handling (if needed)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Staff table has campus_id column with FK to campus
- [x] #2 Staff table has staff_type_id FK replacing staff_type text field
- [x] #3 Staff unique constraints updated to include campus_id
- [x] #4 Guardian table has campus_id column with FK to campus
- [x] #5 Guardian spouse_id column removed
- [x] #6 Guardian unique constraints updated to include campus_id
- [x] #7 Student table has campus_id column with FK to campus
- [x] #8 Student unique constraints updated to include campus_id
- [x] #9 All new FKs have proper onDelete behavior defined
- [x] #10 Prisma schema compiles without errors
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update Campus model - add relations for Staff, Guardian, Student
2. Update Staff model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Add staffTypeId (optional FK to StaffType, onDelete: SetNull)
   - Remove staffType text field
   - Change unique constraints: (campusId, email), (campusId, phoneNumber), (campusId, userId)
   - Add indexes: campusId, staffTypeId
   - Remove index: staffType
3. Update StaffType model - add staff[] relation
4. Update Guardian model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Remove spouse, spouseId, spouseOf fields/relations
   - Change unique constraints: (campusId, email), (campusId, phoneNumber), (campusId, userId)
   - Add index: campusId
   - Remove index: spouseId
5. Update Student model:
   - Add campusId (required FK to Campus, onDelete: Restrict)
   - Change unique: studentCode -> (campusId, studentCode)
   - Add index: campusId
6. Run npx prisma format to validate
7. Verify all relations compile correctly
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Implemented campus scoping for all profile tables (Staff, Guardian, Student).

## Changes Made

### Staff Model
- Added campusId (required FK to Campus, onDelete: Restrict)
- Added staffTypeId (optional FK to StaffType, onDelete: SetNull)
- Removed staffType text field (replaced by FK relation)
- Changed unique constraints to campus-scoped: (campusId, email), (campusId, phoneNumber), (campusId, userId)
- Added indexes: campusId, staffTypeId

### Guardian Model
- Added campusId (required FK to Campus, onDelete: Restrict)
- Removed spouse, spouseId, spouseOf fields (spouse relationship removed)
- Changed unique constraints to campus-scoped: (campusId, email), (campusId, phoneNumber), (campusId, userId)
- Added index: campusId

### Student Model
- Added campusId (required FK to Campus, onDelete: Restrict)
- Changed studentCode unique to (campusId, studentCode)
- Added index: campusId

### User Model
- Changed from one-to-one to one-to-many relations for Staff and Guardian (User can have profiles at multiple campuses)

### Campus Model
- Added staff[], guardians[], students[] relations

### StaffType Model
- Added staff[] relation

## Notes
- All onDelete behaviors use Restrict to prevent accidental cascading deletes
- Schema validates successfully with npx prisma format
<!-- SECTION:NOTES:END -->

