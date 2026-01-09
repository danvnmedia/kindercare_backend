---
id: '22'
title: 'Phase 5.3: Enrollment and ClassStaff Campus Validation'
status: todo
priority: medium
labels:
  - domain
  - enrollment
  - class-staff
  - validation
  - phase-5
createdAt: '2026-01-06T04:36:24.409Z'
updatedAt: '2026-01-06T04:36:24.409Z'
timeSpent: 0
---
# Phase 5.3: Enrollment and ClassStaff Campus Validation

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Enrollment and ClassStaff to validate campus consistency across related entities.

Depends on @task-14 (Student campus), @task-12 (Staff campus), @task-16 (Class campus).
See @doc/migrations/multi-campus-migration for context.

## Enrollment Changes

### Validation Rules
- Student must belong to same campus as Class
- This is enforced by FK constraints, but add domain validation

### Use Case Updates
- enroll-student.use-case.ts
  - Verify student.campusId === class.campusId
  - Return clear error if mismatch
  
- unenroll-student.use-case.ts
  - No special campus changes needed (entities already validated)

### Repository Updates
- Include campus validation in save operations
- Consider adding campus to enrollment queries for performance

## ClassStaff Changes

### Validation Rules
- Staff must belong to same campus as Class
- Subject must belong to same campus as Class

### Use Case Updates
- assign-staff-to-class.use-case.ts
  - Verify staff.campusId === class.campusId
  - Verify subject.campusId === class.campusId
  - Return clear error if mismatch
  
- remove-staff-from-class.use-case.ts
  - No special changes needed

### Repository Updates
- Include campus validation in save operations

## Error Messages
- Provide clear messages for cross-campus assignment attempts
- Example: Cannot enroll student from Campus A into class from Campus B
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Enroll-student validates student and class are in same campus
- [ ] #2 Assign-staff-to-class validates staff, subject, and class are in same campus
- [ ] #3 Clear error messages for cross-campus attempts
- [ ] #4 Repositories validate campus consistency before save
- [ ] #5 Unit tests cover cross-campus rejection scenarios
<!-- AC:END -->

