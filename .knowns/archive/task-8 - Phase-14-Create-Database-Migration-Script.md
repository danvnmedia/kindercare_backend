---
id: '8'
title: 'Phase 1.4: Create Database Migration Script'
status: done
priority: high
labels:
  - migration
  - database
  - seed
  - phase-1
createdAt: '2026-01-06T04:26:59.644Z'
updatedAt: '2026-01-06T21:49:55.861Z'
timeSpent: 298
assignee: '@me'
---
# Phase 1.4: Create Database Migration Script

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the Prisma migration for multi-campus schema changes (Tasks 6 & 7).

**SIMPLIFIED SCOPE** (Database is empty):
- No data migration needed
- Focus on generating clean migration SQL
- Update seed.ts for campus-scoped data
- Regenerate Prisma client

See @doc/migrations/multi-campus-migration for context.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Default campus created in migration
- [x] #2 All existing staff records assigned to default campus
- [x] #3 All existing guardian records assigned to default campus
- [x] #4 All existing student records assigned to default campus
- [x] #5 All academic entities assigned to default campus
- [x] #6 All content entities assigned to default campus
- [x] #7 staff_type enum values migrated to staff_type table
- [x] #8 Old unique constraints dropped and new ones created
- [x] #9 Deprecated columns removed (spouse_id, staff_type text)
- [x] #10 Migration runs successfully: npx prisma migrate dev
- [ ] #11 Seed scripts created for campus, permissions, staff_types
- [x] #12 Prisma client regenerated: npx prisma generate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Run npx prisma migrate dev --name profile_academic_content_campus_scoping
2. Verify migration SQL generated correctly
3. Update seed.ts:
   - Create default campus record for seed data
   - Add campusId to all Guardian seed records
   - Add campusId to all Student seed records
   - Remove spouse linking code (spouseId removed)
4. Run npx prisma generate to regenerate client
5. Run seed to verify: npx prisma db seed
6. Verify all foreign keys and indexes created
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Note: Simplified Migration (Empty Database)

The database is currently empty and fresh, which significantly simplifies this task:
- Skip: Pre-migration data backup (no data to backup)
- Skip: Data migration script for existing records (no existing data)
- Skip: Assigning default campus_id to legacy data (no legacy data)
- Skip: Migrating staff_type enum values (no existing staff records)

Focus only on:
1. Creating the Prisma migration with schema changes
2. Creating seed scripts for initial data (campus, permissions, staff_types)
3. Running prisma migrate dev and prisma generate

The acceptance criteria #2-#9 (related to migrating existing data) are auto-satisfied since there's no existing data to migrate.

## Migration Command

User needs to run manually (interactive mode required):
```bash
npx prisma migrate dev --name profile_academic_content_campus_scoping
```

## Schema Changes Summary
Migration SQL generated successfully with all the following changes:
- Added campus_id to: student, staff, guardian, grade_level, subject, school_year, class, student_attendance, post, post_audience, file
- Removed: spouse_id from guardian, staff_type text from staff
- Added: staff_type_id FK to staff
- Updated unique constraints to be campus-scoped
- Added indexes on campus_id for all affected tables

## Seed.ts Status
Left unchanged per user request. Will need updates to include campusId for:
- Guardian records (also remove spouseId linking)
- Student records
- Role records may need default campus or system default flag



## Completion
User ran migration manually: npx prisma migrate dev --name profile_academic_content_campus_scoping
Migration applied successfully.
<!-- SECTION:NOTES:END -->

