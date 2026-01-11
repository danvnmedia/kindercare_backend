---
id: '24'
title: 'Phase 6.2: Update Seed Scripts for Multi-Campus'
status: blocked
priority: medium
labels:
  - seed
  - database
  - migration
  - phase-6
createdAt: '2026-01-06T04:37:06.262Z'
updatedAt: '2026-01-11T03:23:18.632Z'
timeSpent: 0
---
# Phase 6.2: Update Seed Scripts for Multi-Campus

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update all seed scripts to work with the new multi-campus architecture.

Depends on @task-8 (Schema migration complete).
See @doc/migrations/multi-campus-migration for context.

## Seed Scripts to Update/Create

### New Seeds

**prisma/seeds/seed-campus.ts**
- Create default development campus
- Create test campuses for E2E testing

**prisma/seeds/seed-permissions.ts**
- Seed all code-based permissions
- Permissions organized by module

**prisma/seeds/seed-staff-types.ts**
- Create default staff types per campus
- Map to default roles

### Updated Seeds

**prisma/seeds/seed-roles.ts**
- Create system default roles (campus_id = null)
- Create campus-specific roles
- Assign permissions to roles

**prisma/seeds/seed-students.ts**
- Add campusId to student creation
- Update code generation to use campus-aware service
- Update sync-sequence for campus-scoped sequences

**prisma/seeds/seed-staff.ts** (if exists)
- Add campusId
- Use staff_type_id instead of staff_type enum

**prisma/seeds/seed-guardians.ts** (if exists)
- Add campusId
- Remove spouse_id references

**prisma/seeds/seed-classes.ts** (if exists)
- Add campusId
- Validate gradeLevel and schoolYear are in same campus

**prisma/seeds/seed-posts.ts** (if exists)
- Add campusId
- Validate audiences are in same campus

## Seed Order
1. Campus (must be first)
2. Permissions
3. Roles (needs permissions)
4. Staff Types (needs roles for defaults)
5. Staff/Guardians
6. Students
7. Academic entities
8. Content
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 seed-campus.ts created with default campus
- [ ] #2 seed-permissions.ts created with all permissions
- [ ] #3 seed-staff-types.ts created with default types
- [ ] #4 seed-roles.ts updated for campus scoping
- [ ] #5 seed-students.ts uses campus-aware code generation
- [ ] #6 All existing seeds updated with campusId
- [ ] #7 Seed order documented and correct
- [ ] #8 npm run seed works without errors
- [ ] #9 Seeds are idempotent (can run multiple times)
<!-- AC:END -->

