---
id: '5'
title: 'Phase 1.1: Update Prisma Schema for Multi-Campus Foundation'
status: done
priority: high
labels:
  - migration
  - prisma
  - database
  - phase-1
createdAt: '2026-01-06T04:26:05.966Z'
updatedAt: '2026-01-06T21:05:31.914Z'
timeSpent: 0
---
# Phase 1.1: Update Prisma Schema for Multi-Campus Foundation

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the Prisma schema to add the foundational tables and columns for multi-campus architecture. This is the first and most critical migration step.

See @doc/migrations/multi-campus-migration for full context.
See @diagram/dbdiagram_new.dbml for target schema.

## Changes Required

### New Tables
1. **campus** - Root entity for all campus-scoped data
   - id (uuid, pk), name, address, phone_number, is_active, timestamps

2. **permission** - Atomic code-based permissions
   - id (text, pk), module, description, created_at

3. **role_permission** - Role to permission mapping
   - role_id (uuid), permission_id (text), created_at
   - Composite PK: (role_id, permission_id)

4. **staff_type** - Campus-configurable staff types
   - id (uuid), campus_id, name, description, default_role_id, is_active, timestamps
   - Unique: (campus_id, name)

### Modified Tables
1. **role** - Add campus scoping
   - Add: campus_id (uuid, nullable, FK to campus)
   - Add: is_system_default (boolean, default false)
   - Change: id from text to uuid
   - Add unique index: (campus_id, name)

2. **user_roles** - Add campus scoping
   - Add: campus_id (uuid, nullable, FK to campus)
   - Add: assigned_at (timestamptz)
   - Change: role_id from text to uuid
   - Change PK: (user_id, role_id, campus_id)

3. **student_code_sequence** - Campus-scoped sequences
   - Change PK from (year) to (campus_id, year)
   - Add: campus_id (uuid, FK to campus)

### Important Notes
- This is a breaking change requiring data migration
- Existing roles need to be migrated (either as system defaults or assigned to default campus)
- Create migration script for existing data
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Campus table created with all required columns and indexes
- [x] #2 Permission table created for atomic permissions
- [x] #3 role_permission junction table created with proper FKs
- [x] #4 staff_type table created with campus scoping and default_role_id FK
- [x] #5 Role table modified with campus_id, is_system_default columns
- [x] #6 user_roles table modified with campus_id and assigned_at columns
- [x] #7 student_code_sequence PK changed to (campus_id, year)
- [x] #8 All foreign key relationships properly defined
- [x] #9 Prisma schema compiles without errors (npx prisma format)
- [x] #10 Migration SQL file generated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create new Campus model with: id (uuid), name, address, phone_number, is_active, timestamps
2. Create new Permission model with: id (text pk), module, description, created_at
3. Create new RolePermission model with: role_id (uuid), permission_id (text), composite PK
4. Create new StaffType model with: id (uuid), campus_id FK, name, description, default_role_id FK, is_active, timestamps, unique(campus_id, name)
5. Modify Role model:
   - Change id from String @db.Text to String @default(uuid()) @db.Uuid
   - Add campus_id (optional FK to Campus)
   - Add is_system_default Boolean (default false)
   - Remove global unique on name
   - Add unique(campus_id, name)
   - Keep permissions Json for now (will be deprecated later)
6. Modify UserRole model:
   - Change role_id from String @db.Text to String @db.Uuid
   - Add campus_id (optional FK to Campus)
   - Add assigned_at DateTime
   - Change composite PK from (userId, roleId) to (userId, roleId, campusId)
7. Modify StudentCodeSequence:
   - Add campus_id (uuid FK to Campus)
   - Change PK from year to (campus_id, year)
8. Run npx prisma format to validate schema
9. Generate migration with npx prisma migrate dev --name multi_campus_foundation
10. Review generated SQL and verify all FKs/indexes
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Successfully implemented Phase 1.1 - Prisma Schema for Multi-Campus Foundation.

## Changes Made

### New Tables Created
1. **campus** - Root entity with id (uuid), name, address, phone_number, is_active
2. **permission** - Atomic permissions with id (text), module, description
3. **role_permission** - Junction table mapping roles to permissions
4. **staff_type** - Campus-configurable staff types with default_role_id FK

### Modified Tables
1. **role**:
   - Changed id from TEXT to UUID (with data migration)
   - Added campus_id (nullable FK to campus)
   - Added is_system_default (boolean)
   - Changed unique constraint to (campus_id, name)
   - Existing roles marked as isSystemDefault=true

2. **user_roles**:
   - Added id (uuid) as primary key
   - Changed role_id from TEXT to UUID
   - Added campus_id (nullable FK to campus)
   - Added assigned_at timestamp
   - Changed PK structure with unique constraint on (user_id, role_id, campus_id)

3. **student_code_sequence**:
   - Added campus_id to composite PK
   - PK changed from (year) to (campus_id, year)
   - Existing data migrated to Default Campus

### Files Modified
- prisma/schema.prisma - Schema updates
- prisma/migrations/20260106000000_multi_campus_foundation/migration.sql - Custom migration with data preservation
- prisma/seed.ts - Updated for new Role UUID format

## Migration Notes
- A 'Default Campus' was created (ID: 00000000-0000-0000-0000-000000000001) for existing data
- All existing roles were migrated with new UUIDs and marked as system defaults
- Existing user_roles relationships preserved with new role UUIDs

## Known Type Errors (Expected - To Be Fixed in Later Phases)
Files that need updates for campus-aware operations:
- prisma/seeds/seed-students.ts (StudentCodeSequence needs campusId)
- prisma/seeds/sync-sequence.ts (StudentCodeSequence needs campusId)
- src/infra/persistence/prisma/repositories/prisma-role.repository.ts (Role lookup needs campus context)
- src/infra/persistence/prisma/services/student-code-generator.service.ts (StudentCodeSequence needs campusId)

These will be addressed in Phase 1.2+ when creating the Campus domain module.
<!-- SECTION:NOTES:END -->

