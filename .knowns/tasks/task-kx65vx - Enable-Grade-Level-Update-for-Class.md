---
id: kx65vx
title: Enable Grade Level Update for Class
status: done
priority: high
labels:
  - bug
  - class-management
createdAt: '2026-02-05T18:52:03.490Z'
updatedAt: '2026-02-10T01:25:52.371Z'
timeSpent: 0
---
# Enable Grade Level Update for Class

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The PATCH /classes/:id endpoint currently only supports updating name and description. When the frontend sends a gradeLevelId in the update request, it is silently ignored - the API returns 200 (with updated updatedAt) but the grade level is never persisted. This causes a confusing UX where the update appears successful but nothing actually changes. The fix requires threading gradeLevelId support through all clean architecture layers: DTO, domain entity, use case (with validation), mapper, and controller.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PATCH /classes/:id accepts optional gradeLevelId field and persists the change
- [x] #2 Grade level existence and campus ownership are validated before update (reuse pattern from CreateClassUseCase)
- [x] #3 Uniqueness constraint (campusId, schoolYearId, gradeLevelId, name) is checked when gradeLevelId or name changes
- [x] #4 UpdateClassRequest DTO validates gradeLevelId as optional UUID
- [x] #5 Domain entity UpdateClassData type includes gradeLevelId
- [x] #6 Entity update() method sets gradeLevelId when provided
- [x] #7 PrismaClassMapper.toPrismaUpdate includes gradeLevelId in output
- [x] #8 Use case injects GradeLevelRepository for validation
- [x] #9 Unit tests cover: grade level update, invalid grade level ID, cross-campus grade level rejection, uniqueness conflict on grade level change
- [x] #10 API returns the updated class with the new gradeLevel relation populated
- [ ] #11 PrismaClassMapper.toPrismaUpdate uses Prisma.ClassUncheckedUpdateInput (not ClassUpdateInput) so gradeLevelId is not silently dropped
- [ ] #12 Frontend UpdateClassInput type includes gradeLevelId (not omitted)
- [ ] #13 Frontend class-dialog.tsx sends gradeLevelId in the update payload
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Layer 1: Request DTO (Presentation)
**File:** src/infra/http/dtos/class-management/update-class.request.ts
- Add optional gradeLevelId field with @IsOptional(), @IsUUID() validators
- Add @ApiProperty decorator with description and example

### Layer 2: Domain Entity
**File:** src/domain/class-management/entities/class.entity.ts
- Extend UpdateClassData type: change from Partial<Pick<ClassProps, 'name' | 'description'>> to Partial<Pick<ClassProps, 'name' | 'description' | 'gradeLevelId'>>
- Add gradeLevelId handling in update() method: if (data.gradeLevelId \!== undefined) { this.props.gradeLevelId = data.gradeLevelId; }

### Layer 3: Use Case (Application)
**File:** src/application/class-management/use-cases/class/update-class.use-case.ts
- Inject GradeLevelRepository (same pattern as CreateClassUseCase)
- Change execute() input type to accept gradeLevelId alongside existing UpdateClassData fields
- Before calling classEntity.update(), if gradeLevelId is provided and different from current:
  1. Validate grade level exists via gradeLevelRepository.findById()
  2. Validate grade level belongs to same campus (gradeLevel.campusId === classEntity.campusId)
  3. Check uniqueness with new gradeLevelId: findByNameInContextAndCampus(effectiveName, campusId, schoolYearId, newGradeLevelId)
- Update existing uniqueness check (line 34-47) to use the effective gradeLevelId (new if changing, existing if not) and effective name (new if changing, existing if not)

### Layer 4: Prisma Mapper (Infrastructure)
**File:** src/infra/persistence/prisma/mapper/prisma-class.mapper.ts
- Update toPrismaUpdate() to include gradeLevelId: classEntity.gradeLevelId in the returned object

### Layer 5: Controller (Presentation)
**File:** src/infra/http/controllers/class-management/class.controller.ts
- Update @ApiOperation description from 'Update class name or description' to 'Update class name, description, or grade level'
- No other code changes needed - DTO flows through naturally

### Layer 6: Module Wiring
- Verify GradeLevelRepository is available for injection in the class module
- If not already provided, add it to the module providers

### Layer 7: Unit Tests
**New/updated files:**
- src/domain/class-management/entities/class.entity.spec.ts: update() sets gradeLevelId when provided, does not change it when omitted
- src/application/class-management/use-cases/class/update-class.use-case.spec.ts: successfully updates grade level, rejects non-existent grade level, rejects cross-campus grade level, rejects duplicate name in new grade level context, updates both name and grade level simultaneously

### Files Changed Summary
1. src/infra/http/dtos/class-management/update-class.request.ts (add gradeLevelId field)
2. src/domain/class-management/entities/class.entity.ts (extend UpdateClassData type + update method)
3. src/application/class-management/use-cases/class/update-class.use-case.ts (add validation + inject GradeLevelRepository)
4. src/infra/persistence/prisma/mapper/prisma-class.mapper.ts (add gradeLevelId to toPrismaUpdate)
5. src/infra/http/controllers/class-management/class.controller.ts (update API docs)
6. Module file if GradeLevelRepository not already wired
7. Test files (new)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found two additional bugs preventing grade level update from working end-to-end: (1) Prisma mapper used ClassUpdateInput instead of ClassUncheckedUpdateInput, silently dropping gradeLevelId; (2) Frontend types and dialog excluded gradeLevelId from the update payload.
<!-- SECTION:NOTES:END -->

