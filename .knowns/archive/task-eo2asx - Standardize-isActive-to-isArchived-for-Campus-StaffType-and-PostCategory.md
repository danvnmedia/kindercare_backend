---
id: eo2asx
title: 'Standardize isActive to isArchived for Campus, StaffType, and PostCategory'
status: done
priority: medium
labels:
  - refactor
  - schema
createdAt: '2026-02-13T03:11:54.947Z'
updatedAt: '2026-02-13T19:47:53.305Z'
timeSpent: 8232
assignee: '@me'
---
# Standardize isActive to isArchived for Campus, StaffType, and PostCategory

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reduce confusion by standardizing on a single soft-delete boolean pattern. Currently the codebase uses isActive (default true) on some tables and isArchived (default false) on others. Standardize Campus, StaffType, and PostCategory to use isArchived. User.isActive is intentionally kept as-is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Campus: isActive replaced with isArchived across all layers (schema, entity, DTOs, mapper, repository, use cases, controller, tests, seed)
- [x] #2 StaffType: isActive replaced with isArchived across all layers (schema, entity, DTOs, mapper, repository, use cases, controller, tests)
- [x] #3 PostCategory: isActive replaced with isArchived across all layers (schema, entity, DTOs, mapper, repository, use cases, controller)
- [x] #4 Prisma migration created with data migration for Campus and StaffType (invert existing boolean values)
- [x] #5 Domain methods renamed: activate/deactivate → unarchive/archive, default changes from true → false
- [x] #6 Repository existsAndActive renamed to existsAndNotArchived (StaffType), findActivesByCampusId removed or renamed (PostCategory)
- [x] #7 Delete use cases updated: deactivate() → archive(), controller docs updated accordingly
- [x] #8 All existing tests updated and passing
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Phase 1: Prisma schema + migration
Phase 2: Domain entities (Campus, StaffType, PostCategory)
Phase 3: Application layer (use cases, ports)
Phase 4: Infrastructure layer (mappers, repositories)
Phase 5: HTTP layer (DTOs, controllers)
Phase 6: Tests, seed, factories
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Scope
- **Change**: Campus, StaffType, PostCategory — isActive(true) → isArchived(false)
- **Keep**: User.isActive unchanged
- **Data migration**: Campus & StaffType need boolean inversion; PostCategory is empty, no data migration needed

## Files by Entity

### Campus (19 files)
- prisma/schema.prisma (field + default)
- src/domain/campus/entities/campus.entity.ts (props, getter, activate→unarchive, deactivate→archive, create factory default)
- src/domain/campus/entities/campus.entity.spec.ts
- src/application/campus/use-cases/create-campus.use-case.ts + spec
- src/application/campus/use-cases/update-campus.use-case.ts + spec
- src/application/campus/use-cases/delete-campus.use-case.ts + spec (deactivate→archive)
- src/application/campus/use-cases/get-all-campuses.use-case.spec.ts
- src/infra/persistence/prisma/mapper/prisma-campus.mapper.ts
- src/infra/persistence/prisma/repositories/prisma-campus.repository.ts (filter/sort fields)
- src/infra/http/dtos/campus/create-campus.request.ts
- src/infra/http/dtos/campus/update-campus.request.ts
- src/infra/http/dtos/campus/campus.response.ts
- src/infra/http/controllers/campus.controller.ts (swagger docs)
- src/test-utils/entity-factories.ts
- prisma/seed.ts

### StaffType (16 files)
- prisma/schema.prisma
- src/domain/user-management/entities/staff-type.entity.ts + spec
- src/application/user-management/use-cases/staff-type/create-staff-type.use-case.ts
- src/application/user-management/use-cases/staff-type/update-staff-type.use-case.ts
- src/application/user-management/use-cases/staff-type/delete-staff-type.use-case.ts
- src/application/user-management/ports/staff-type.repository.ts (existsAndActive→existsAndNotArchived)
- src/infra/persistence/prisma/mapper/prisma-staff-type.mapper.ts
- src/infra/persistence/prisma/repositories/prisma-staff-type.repository.ts
- src/infra/http/dtos/user-management/staff-type/ (create, update, response)
- src/infra/http/controllers/user-management/staff-type.controller.ts

### PostCategory (8 files)
- prisma/schema.prisma (field + index)
- src/domain/content-management/entities/post-category.entity.ts
- src/application/content-management/ports/post-category.repository.ts (findActivesByCampusId→findNonArchivedByCampusId)
- src/application/content-management/use-cases/category/delete-post-category.use-case.ts
- src/infra/persistence/prisma/mapper/prisma-post-category.mapper.ts
- src/infra/persistence/prisma/repositories/prisma-post-category.repository.ts
- src/infra/http/dtos/post/category/post-category.response.ts
- src/infra/http/controllers/post-category.controller.ts

## Migration SQL Pattern
ALTER TABLE "campuses" RENAME COLUMN "is_active" TO "is_archived";
ALTER TABLE "campuses" ALTER COLUMN "is_archived" SET DEFAULT false;
UPDATE "campuses" SET "is_archived" = NOT "is_archived";
(Same for staff_types table)
(PostCategory: just rename + change default, no data inversion needed)

Done: Standardized isActive→isArchived across Campus, StaffType, PostCategory. 43 files changed. All 473 tests pass. Migration includes data inversion for Campus/StaffType. Also fixed campus.guard and create/update-staff use cases that referenced StaffType.isActive.
<!-- SECTION:NOTES:END -->

