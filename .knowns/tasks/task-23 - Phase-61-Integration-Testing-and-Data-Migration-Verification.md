---
id: '23'
title: 'Phase 6.1: Integration Testing and Data Migration Verification'
status: todo
priority: high
labels:
  - testing
  - integration
  - migration
  - verification
  - phase-6
createdAt: '2026-01-06T04:36:43.553Z'
updatedAt: '2026-01-06T04:36:43.553Z'
timeSpent: 0
---
# Phase 6.1: Integration Testing and Data Migration Verification

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Comprehensive integration testing and verification of the multi-campus migration.

Depends on all Phase 1-5 tasks.
See @doc/migrations/multi-campus-migration for context.

## Test Scenarios

### Campus Isolation Tests
1. Create campus A and campus B
2. Create entities in each campus
3. Verify users in campus A cannot access campus B data
4. Verify global admins can access both

### Entity Creation Tests
- Create staff in campus A
- Create guardian in campus A
- Create student in campus A with auto-generated code
- Create grade levels, subjects, school years
- Create classes with proper relations
- Create posts with audiences
- Upload files

### Cross-Campus Prevention Tests
- Attempt to enroll campus A student in campus B class
- Attempt to assign campus A staff to campus B class
- Attempt to create post with audiences from different campus
- Attempt to attach file from different campus to post

### RBAC Tests
- Create campus-specific role with permissions
- Assign role to user for specific campus
- Verify user has permission in that campus only
- Test global roles (null campusId) grant access everywhere

### Code Generation Tests
- Generate student code in campus A
- Generate student code in campus B
- Verify each campus maintains independent sequence
- Test year rollover behavior

### Data Migration Verification
- Verify all existing data assigned to default campus
- Verify no orphaned records
- Verify FK integrity
- Verify unique constraints work correctly

## Performance Checks
- List queries with campus filtering perform well
- Indexes are utilized properly

## Cleanup
- Document rollback procedure
- Prepare data cleanup scripts if needed
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Campus isolation tests pass (A cannot see B)
- [ ] #2 All entity creation tests pass with campusId
- [ ] #3 Cross-campus prevention tests pass (proper rejections)
- [ ] #4 Campus-scoped RBAC tests pass
- [ ] #5 Global admin can access all campuses
- [ ] #6 Student code generation works per campus
- [ ] #7 Existing data properly migrated to default campus
- [ ] #8 No orphaned or invalid records
- [ ] #9 Performance acceptable with campus filtering
- [ ] #10 E2E test suite updated for multi-campus
<!-- AC:END -->

