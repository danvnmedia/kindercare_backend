---
title: Multi-Campus Migration
createdAt: '2026-01-06T04:25:12.602Z'
updatedAt: '2026-01-06T04:25:42.446Z'
description: >-
  Documentation for migrating from single-school to multi-campus federated
  architecture. Details schema changes, affected code, and migration strategy.
tags:
  - migration
  - architecture
  - campus
---
# Multi-Campus Migration Plan

## Overview

This migration transitions the Kindercare backend from a single-school architecture to a federated multi-campus architecture. The key principle is: **Global User Identity + Campus-Scoped Everything Else**.

## Key Schema Changes

### 1. New Root Entity: Campus
- New `campus` table as the root entity for all campus-scoped data
- Properties: id, name, address, phone_number, is_active

### 2. Access Control (RBAC) Evolution
- New `permission` table for atomic code-based permissions
- `role` table gets optional `campus_id` (nullable for system defaults)
- `user_roles` gains `campus_id` for scoped role assignment
- New `role_permission` mapping table
- Added `is_system_default` to protect core roles

### 3. Staff Management
- New `staff_type` table (replaces enum) with campus scoping
- `staff_type` has `default_role_id` for auto-assignment
- Staff gains `campus_id` and `staff_type_id` (FK to new table)

### 4. Guardian Changes
- Guardians become campus-scoped (new `campus_id` column)
- Email/phone unique per campus (not globally)
- `spouse_id` column removed

### 5. Uniqueness Constraints
All global unique constraints become campus-composite:
- student_code: global -> (campus_id, student_code)
- staff.email: global -> (campus_id, email)
- guardian.email: global -> (campus_id, email)
- class: (year, grade, name) -> (campus_id, year, grade, name)

### 6. Campus-Scoped Tables
- student, guardian, staff
- grade_level, subject, school_year, class
- post, post_audience, file
- student_attendance
- student_code_sequence (PK: campus_id + year)

## Affected Code by Layer

### Domain Layer
- New: Campus entity
- Modified: Staff, Guardian, Student, GradeLevel, Subject, SchoolYear, Class, Post, File entities
- New: Permission, StaffType entities
- Updated: Role entity (campus_id)
- Removed: staff-type.enum.ts (replaced by table)

### Application Layer (Ports & Use Cases)
- New: CampusRepository, PermissionRepository, StaffTypeRepository
- Modified: All repositories need campus-aware methods
- Modified: All use cases need campus context

### Infrastructure Layer
- Prisma schema updates
- All repositories need campus filtering
- All mappers need campus handling
- Student code generator needs campus parameter

### HTTP Layer
- All controllers need campus context (from auth/header)
- All DTOs need campus consideration
- Guards may need campus-aware checks

## Migration Dependencies

```
Phase 1: Foundation
├── 1.1 Update Prisma Schema (Campus, Permission, StaffType tables)
├── 1.2 Create Campus Domain Module
└── 1.3 Create Permission/RBAC Module

Phase 2: Profile Scoping
├── 2.1 Staff Type Migration (enum -> table)
├── 2.2 Staff Campus Scoping
├── 2.3 Guardian Campus Scoping (+ remove spouse_id)
└── 2.4 Student Campus Scoping

Phase 3: Academic Scoping
├── 3.1 Grade Level Campus Scoping
├── 3.2 Subject Campus Scoping
├── 3.3 School Year Campus Scoping
└── 3.4 Class Campus Scoping

Phase 4: Operations Scoping
├── 4.1 Student Attendance Campus Scoping
├── 4.2 Post/Content Campus Scoping
├── 4.3 File Campus Scoping
└── 4.4 Student Code Sequence Campus Scoping

Phase 5: Finalization
├── 5.1 RBAC Role Campus Scoping
├── 5.2 User Roles Campus Scoping
└── 5.3 Integration Testing & Data Migration
```

## File Impact Analysis

### High Impact (Major Changes)
- prisma/schema.prisma
- All domain entities
- All repository implementations
- All use cases
- Student code generator service

### Medium Impact (Campus Context)
- All controllers
- All DTOs
- Guards and decorators
- Module configurations

### Low Impact (Minor Updates)
- Mappers (add campus fields)
- Response DTOs
- Test files
