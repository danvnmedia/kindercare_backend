---
id: cgthth
title: Add Ordering/Reorder Functionality to Staff Types
status: done
priority: medium
labels:
  - backend
  - staff-type
  - feature
createdAt: '2026-01-20T16:59:28.782Z'
updatedAt: '2026-01-20T17:16:46.005Z'
timeSpent: 768
---
# Add Ordering/Reorder Functionality to Staff Types

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add ordering functionality to Staff Types, similar to how Grade Levels are implemented. This allows campuses to define a display order for their staff types (e.g., Teacher, Assistant Teacher, Aide, Volunteer).

## Background
Grade Levels have an `order` field that allows campuses to reorder how grade levels appear in lists and dropdowns. Staff Types currently lack this capability - they are sorted alphabetically by name.

## References
- Pattern to follow: Grade Level entity and reorder use case
- See: `src/domain/class-management/entities/grade-level.entity.ts`
- See: `src/application/class-management/use-cases/grade-level/reorder-grade-levels.use-case.ts`
- See: `src/infra/persistence/prisma/repositories/prisma-grade-level.repository.ts` (reorder method)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 StaffType entity has 'order' field (non-negative integer) with updateOrder() method
- [x] #2 Prisma schema updated with 'order' field and @@unique([campusId, order]) constraint
- [x] #3 Database migration created and applied successfully
- [x] #4 StaffTypeRepository interface extended with: findByOrderAndCampus(), getMaxOrder(), reorder()
- [x] #5 Repository reorder() implements two-phase transaction (negative temp values → positive final values)
- [x] #6 CreateStaffTypeUseCase auto-assigns order (maxOrder + 1) when order not provided
- [x] #7 CreateStaffTypeUseCase validates order uniqueness when order is explicitly provided
- [x] #8 UpdateStaffTypeUseCase validates order uniqueness when updating order field
- [x] #9 ReorderStaffTypesUseCase created with campus validation and ID existence checks
- [x] #10 POST /staff-types/reorder endpoint available with ReorderStaffTypesRequest DTO
- [x] #11 GET /staff-types returns results ordered by 'order' field ASC (not name)
- [x] #12 StaffTypeResponse DTO includes 'order' field
- [x] #13 Unit tests for ReorderStaffTypesUseCase with campus isolation and error cases
- [x] #14 Existing StaffType tests updated to accommodate order field
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Database Layer
1. **Update Prisma Schema** (`prisma/schema.prisma`)
   - Add `order Int` field to StaffType model
   - Add `@@unique([campusId, order])` constraint
   - Add `@@index([order])` for query performance

2. **Generate & Apply Migration**
   - Run `npx prisma migrate dev --name add_order_to_staff_type`
   - Migration must handle existing data (assign sequential order values)

### Phase 2: Domain Layer
3. **Update StaffType Entity** (`src/domain/user-management/entities/staff-type.entity.ts`)
   - Add `order: number` to `StaffTypeProps` interface
   - Add `order` getter
   - Add `updateOrder(order: number)` method with validation (must be >= 0)
   - Update `create()` factory to require/accept order
   - Update `update()` method to handle order changes

4. **Update Entity Tests** (`src/domain/user-management/entities/staff-type.entity.spec.ts`)
   - Add tests for order validation in create()
   - Add tests for updateOrder() method
   - Add tests for order in update()

### Phase 3: Persistence Layer
5. **Update Mapper** (`src/infra/persistence/prisma/mapper/prisma-staff-type.mapper.ts`)
   - Include `order` field in toDomain()
   - Include `order` field in toPrisma()
   - Include `order` field in toPrismaUpdate()

6. **Update Repository Interface** (`src/application/user-management/ports/staff-type.repository.ts`)
   - Add `findByOrderAndCampus(order: number, campusId: string): Promise<StaffType | null>`
   - Add `getMaxOrder(campusId: string): Promise<number>`
   - Add `reorder(campusId: string, ids: string[]): Promise<StaffType[]>`

7. **Update Repository Implementation** (`src/infra/persistence/prisma/repositories/prisma-staff-type.repository.ts`)
   - Implement `findByOrderAndCampus()`
   - Implement `getMaxOrder()` using aggregation
   - Implement `reorder()` with two-phase transaction:
     * Phase 1: Set temporary negative values (-(index+1))
     * Phase 2: Set final positive values (index+1)
   - Update `findByCampusId()` to order by `order` ASC
   - Update `findAll()` default sort to `order` ASC

### Phase 4: Application Layer
8. **Update CreateStaffTypeUseCase** (`src/application/user-management/use-cases/staff-type/create-staff-type.use-case.ts`)
   - If order not provided: auto-assign using `getMaxOrder() + 1`
   - If order provided: validate uniqueness using `findByOrderAndCampus()`
   - Throw ConflictException if order already exists

9. **Update UpdateStaffTypeUseCase** (`src/application/user-management/use-cases/staff-type/update-staff-type.use-case.ts`)
   - If order is being changed: validate uniqueness
   - Allow same order (no-op) without error
   - Throw ConflictException if new order conflicts

10. **Create ReorderStaffTypesUseCase** (`src/application/user-management/use-cases/staff-type/reorder-staff-types.use-case.ts`)
    - Input: `{ campusId: string, ids: string[] }`
    - Validation:
      * All IDs must exist
      * All staff types must belong to specified campusId
      * Return 404 for campus mismatch (security - don't reveal cross-campus info)
    - Call `repository.reorder(campusId, ids)`
    - Return reordered staff types

11. **Create ReorderStaffTypesUseCase Tests** (`src/application/user-management/use-cases/staff-type/reorder-staff-types.use-case.spec.ts`)
    - Test: throws NotFoundException when ID belongs to different campus
    - Test: throws BadRequestException when ID doesn't exist
    - Test: collects all missing IDs before throwing
    - Test: successful reorder returns updated array
    - Test: single item reorder works
    - Test: empty array handling

### Phase 5: HTTP Layer
12. **Create ReorderStaffTypesRequest DTO** (`src/infra/http/dtos/user-management/staff-type/reorder-staff-types.request.ts`)
    - `ids: string[]` with @IsArray(), @ArrayMinSize(1), @IsUUID("4", { each: true })

13. **Update StaffTypeResponse DTO** (`src/infra/http/dtos/user-management/staff-type/staff-type.response.ts`)
    - Add `order: number` with @Expose()

14. **Update DTO Index** (`src/infra/http/dtos/user-management/staff-type/index.ts`)
    - Export ReorderStaffTypesRequest

15. **Update StaffTypeController** (`src/infra/http/controllers/user-management/staff-type.controller.ts`)
    - Add new endpoint:
      ```
      @Post("reorder")
      @RequireCampusAccess()
      @StandardResponse({ message: "Staff types reordered successfully", type: StaffTypeResponse })
      async reorder(@CampusContext() campusId: string, @Body() dto: ReorderStaffTypesRequest)
      ```
    - Inject ReorderStaffTypesUseCase in constructor

16. **Update StaffType Module** (`src/infra/http/modules/staff-type.module.ts`)
    - Add ReorderStaffTypesUseCase to providers

### Phase 6: Verification
17. **Run All Tests**
    - `npm run test` - Unit tests
    - `npm run test:e2e` - E2E tests (if applicable)
    - Verify no regressions

18. **Manual API Testing**
    - Test create without order (auto-assign)
    - Test create with explicit order
    - Test create with duplicate order (expect 409)
    - Test update order
    - Test reorder endpoint
    - Test GET returns ordered by order field

---

## Files to Modify (13 files)
1. `prisma/schema.prisma`
2. `src/domain/user-management/entities/staff-type.entity.ts`
3. `src/domain/user-management/entities/staff-type.entity.spec.ts`
4. `src/infra/persistence/prisma/mapper/prisma-staff-type.mapper.ts`
5. `src/application/user-management/ports/staff-type.repository.ts`
6. `src/infra/persistence/prisma/repositories/prisma-staff-type.repository.ts`
7. `src/application/user-management/use-cases/staff-type/create-staff-type.use-case.ts`
8. `src/application/user-management/use-cases/staff-type/update-staff-type.use-case.ts`
9. `src/infra/http/dtos/user-management/staff-type/staff-type.response.ts`
10. `src/infra/http/dtos/user-management/staff-type/index.ts`
11. `src/infra/http/controllers/user-management/staff-type.controller.ts`
12. `src/infra/http/modules/staff-type.module.ts`
13. `src/application/user-management/use-cases/staff-type/index.ts`

## Files to Create (2 files)
1. `src/infra/http/dtos/user-management/staff-type/reorder-staff-types.request.ts`
2. `src/application/user-management/use-cases/staff-type/reorder-staff-types.use-case.ts`
3. `src/application/user-management/use-cases/staff-type/reorder-staff-types.use-case.spec.ts`

## Key Technical Decisions
- **Two-phase reorder transaction**: Required to avoid unique constraint violations during reorder
- **Auto-assign order on create**: Uses maxOrder + 1 pattern for seamless creation
- **Campus-scoped ordering**: Order is unique per campus, not globally
- **Soft delete compatibility**: Ordering works independently of isActive status
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

Successfully implemented ordering/reorder functionality for Staff Types following the Grade Level pattern.

### Files Modified (13)
1. prisma/schema.prisma - Added order field, @@unique([campusId, order])
2. src/domain/user-management/entities/staff-type.entity.ts - Added order field, updateOrder()
3. src/domain/user-management/entities/staff-type.entity.spec.ts - Updated tests for order
4. src/infra/persistence/prisma/mapper/prisma-staff-type.mapper.ts - Added order to mapping
5. src/application/user-management/ports/staff-type.repository.ts - Added new methods
6. src/infra/persistence/prisma/repositories/prisma-staff-type.repository.ts - Implemented reorder
7. src/application/user-management/use-cases/staff-type/create-staff-type.use-case.ts - Auto-order
8. src/application/user-management/use-cases/staff-type/update-staff-type.use-case.ts - Order validation
9. src/infra/http/dtos/user-management/staff-type/staff-type.response.ts - Added order
10. src/infra/http/dtos/user-management/staff-type/index.ts - Export new DTO
11. src/infra/http/controllers/user-management/staff-type.controller.ts - Reorder endpoint
12. src/infra/http/modules/staff-type.module.ts - New use case provider
13. src/application/user-management/use-cases/staff-type/index.ts - Export reorder

### Files Created (3)
1. prisma/migrations/20260120120000_add_order_to_staff_type/migration.sql
2. src/application/user-management/use-cases/staff-type/reorder-staff-types.use-case.ts
3. src/application/user-management/use-cases/staff-type/reorder-staff-types.use-case.spec.ts
4. src/infra/http/dtos/user-management/staff-type/reorder-staff-types.request.ts

### Key Implementation Details
- Two-phase transaction for reorder (negative temp → positive final values)
- Auto-assign order using maxOrder + 1 when not provided
- Campus-scoped ordering with @@unique([campusId, order])
- 444 tests pass including 7 new tests for ReorderStaffTypesUseCase
<!-- SECTION:NOTES:END -->

