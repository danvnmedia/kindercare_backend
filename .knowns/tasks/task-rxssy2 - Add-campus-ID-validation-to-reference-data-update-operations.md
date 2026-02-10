---
id: rxssy2
title: Add campus ID validation to reference data update operations
status: done
priority: high
labels:
  - security
  - bug
  - reference-data
createdAt: '2026-01-17T04:13:44.800Z'
updatedAt: '2026-01-17T04:30:02.761Z'
timeSpent: 822
assignee: '@me'
---
# Add campus ID validation to reference data update operations

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Security gap: Update operations for GradeLevel and SchoolYear do not validate that the entity belongs to the requesting user's campus. A user with access to Campus A could potentially modify entities belonging to Campus B by providing that entity's ID. Delete operations correctly validate campus ownership, but update and reorder operations are missing this check.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Grade Level update validates entity belongs to requesting campus
- [x] #2 School Year update validates entity belongs to requesting campus
- [x] #3 Reorder Grade Levels validates all IDs belong to requesting campus
- [x] #4 Unauthorized campus access returns 404 (consistent with delete behavior)
- [x] #5 Unit tests cover cross-campus access attempts
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Analysis

### Current State
- **Delete operations**: Correctly validate campus ownership (lines 32-37 in both delete use cases)
- **Update operations**: Missing validation
- **Reorder operation**: Validates IDs exist but not campus ownership

### Files to Modify

1. `src/application/class-management/use-cases/grade-level/update-grade-level.use-case.ts`
2. `src/application/class-management/use-cases/school-year/update-school-year.use-case.ts`
3. `src/application/class-management/use-cases/grade-level/reorder-grade-levels.use-case.ts`
4. `src/infra/http/controllers/class-management/reference-data.controller.ts`

---

## Implementation Steps

### Step 1: Fix Grade Level Update

**Controller** (`reference-data.controller.ts:156`):
- Pass `campusId` to the use case (currently not passed)

**Use Case** (`update-grade-level.use-case.ts`):
- Add `campusId` parameter to execute method signature
- Add validation after finding entity:
```typescript
if (campusId && gradeLevel.campusId !== campusId) {
  throw new NotFoundException(
    `Grade level with ID ${id} not found in this campus`
  );
}
```

### Step 2: Fix School Year Update

**Use Case** (`update-school-year.use-case.ts`):
- Extract `campusId` from input (already passed from controller)
- Add validation after finding entity:
```typescript
if (input.campusId && schoolYear.campusId !== input.campusId) {
  throw new NotFoundException(
    `School year with ID ${id} not found in this campus`
  );
}
```

### Step 3: Fix Reorder Grade Levels

**Use Case** (`reorder-grade-levels.use-case.ts`):
- Modify validation loop (lines 29-34) to also check campus ownership:
```typescript
for (const id of input.ids) {
  const gradeLevel = await this.gradeLevelRepository.findById(id);
  if (!gradeLevel) {
    missingIds.push(id);
  } else if (gradeLevel.campusId !== input.campusId) {
    throw new NotFoundException(
      `Grade level with ID ${id} not found in this campus`
    );
  }
}
```

### Step 4: Add Unit Tests

- Test update with valid campus ID (should succeed)
- Test update with mismatched campus ID (should return 404)
- Test reorder with IDs from different campus (should return 404)

---

## Error Response Pattern

Follow existing delete behavior:
- Return `NotFoundException` with message: `"[Entity] with ID {id} not found in this campus"`
- This prevents information leakage (attacker cannot determine if ID exists in another campus)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Files Modified
1. `src/application/class-management/use-cases/grade-level/update-grade-level.use-case.ts`
   - Added campusId parameter to execute method
   - Added Step 2: campus ownership validation after finding entity

2. `src/application/class-management/use-cases/school-year/update-school-year.use-case.ts`
   - Added Step 2: campus ownership validation (input.campusId already passed from controller)

3. `src/application/class-management/use-cases/grade-level/reorder-grade-levels.use-case.ts`
   - Added campus ownership check in validation loop (fails fast on mismatch)
   - Imported NotFoundException

4. `src/infra/http/controllers/class-management/reference-data.controller.ts`
   - Updated updateGradeLevel to pass campusId to use case

### Test Files Created
- `update-grade-level.use-case.spec.ts` (10 tests)
- `update-school-year.use-case.spec.ts` (10 tests)
- `reorder-grade-levels.use-case.spec.ts` (9 tests)

### Security Pattern
All cross-campus access attempts return NotFoundException (consistent with delete) to prevent information leakage about entities in other campuses.
<!-- SECTION:NOTES:END -->

