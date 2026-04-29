---
id: '11'
title: 'Phase 2.3: Create StaffType Module (Replace Enum)'
status: done
priority: high
labels:
  - domain
  - staff-type
  - migration
  - phase-2
createdAt: '2026-01-06T04:28:23.310Z'
updatedAt: '2026-01-07T03:15:25.270Z'
timeSpent: 696
assignee: '@me'
---
# Phase 2.3: Create StaffType Module (Replace Enum)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the staff_type enum with a configurable StaffType table that is campus-scoped and supports default role assignment.

Depends on @task-8 (Schema migration), @task-9 (Campus module), @task-10 (RBAC module).
See @doc/migrations/multi-campus-migration for context.

## Current State
- staff.staff_type is a text field with enum values: TEACHER, NURSE, PRINCIPAL, STAFF
- Defined in: src/domain/user-management/enums/staff-type.enum.ts

## Target State
- staff_type is a table with campus scoping
- Each campus can define their own staff types
- Staff types can have a default role for auto-assignment

## Domain Layer

### New Entity: StaffType
**File**: src/domain/user-management/entities/staff-type.entity.ts
- Properties: campusId, name, description, defaultRoleId, isActive
- Factory method with validation
- Domain methods: update(), activate(), deactivate()

### Updated Entity: Staff
**File**: src/domain/user-management/entities/staff.entity.ts
- Change: staffType (string) -> staffTypeId (string, FK)
- Add method: changeStaffType(staffTypeId)
- Remove direct staffType enum reference

### Deprecated
**File**: src/domain/user-management/enums/staff-type.enum.ts
- Mark as deprecated or remove after migration

## Application Layer

### New Port: StaffTypeRepository
**File**: src/application/user-management/ports/staff-type.repository.ts
- findById(id)
- findByName(campusId, name)
- findByCampusId(campusId)
- findAll(params)
- save, update, delete

### New Use Cases
**Dir**: src/application/user-management/use-cases/staff-type/
- create-staff-type.use-case.ts
- get-staff-type-by-id.use-case.ts
- get-all-staff-types.use-case.ts (filtered by campus)
- update-staff-type.use-case.ts
- delete-staff-type.use-case.ts

### Updated Use Cases
- create-staff.use-case.ts - Accept staffTypeId, use default role if configured
- update-staff.use-case.ts - Handle staffTypeId changes

## Infrastructure Layer

### New Files
- prisma-staff-type.repository.ts
- prisma-staff-type.mapper.ts

### Updated Files
- prisma-staff.repository.ts - Include staffType relation
- prisma-staff.mapper.ts - Map staffTypeId instead of staffType

## HTTP Layer

### New Controller
**File**: src/infra/http/controllers/user-management/staff-type.controller.ts
- CRUD endpoints for staff types
- Scoped to campus

### New DTOs
**Dir**: src/infra/http/dtos/user-management/staff-type/
- create-staff-type.request.ts (name, description, defaultRoleId?, isActive)
- update-staff-type.request.ts
- staff-type.response.ts

### Updated DTOs
- create-staff.request.ts - staffType enum -> staffTypeId UUID
- staff.response.ts - Include staffType object instead of string
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 StaffType entity created with campus scoping
- [x] #2 StaffTypeRepository port defined
- [x] #3 All StaffType use cases created
- [x] #4 Staff entity updated to use staffTypeId FK
- [x] #5 Staff use cases updated for staffTypeId
- [x] #6 StaffType enum deprecated/removed
- [x] #7 Prisma repository and mapper created
- [x] #8 StaffType controller and DTOs created
- [x] #9 Staff DTOs updated
- [x] #10 Create-staff auto-assigns role from staffType.defaultRoleId
- [x] #11 Unit tests created/updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Domain Layer

### 1.1 Create StaffType Entity
**File**: src/domain/user-management/entities/staff-type.entity.ts
- Props: campusId, name, description, defaultRoleId, isActive, createdAt, updatedAt
- Factory method with validation (name required, unique per campus)
- Domain methods: update(), activate(), deactivate(), setDefaultRole()
- Follow Campus entity pattern

### 1.2 Update Staff Entity  
**File**: src/domain/user-management/entities/staff.entity.ts
- Change: staffType (enum) → staffTypeId (string | null FK)
- Add campusId property (required - per schema)
- Update changeType() → changeStaffType(staffTypeId)
- Update factory validation (remove enum validation)
- Remove static getTypeDisplayName() and getStaffRoleId() (moved to StaffType)

### 1.3 Deprecate StaffType Enum
**File**: src/domain/user-management/enums/staff-type.enum.ts  
- Add @deprecated JSDoc comment
- Keep for backward compatibility during migration

## Phase 2: Application Layer

### 2.1 Create StaffTypeRepository Port
**File**: src/application/user-management/ports/staff-type.repository.ts
- findById(id): Promise<StaffType | null>
- findByName(campusId, name): Promise<StaffType | null>
- findByCampusId(campusId): Promise<StaffType[]>
- findAll(params): Promise<PaginatedResult<StaffType>>
- save(staffType): Promise<StaffType>
- update(staffType): Promise<StaffType>
- delete(id): Promise<void>
- exists(id): Promise<boolean>

### 2.2 Create StaffType Use Cases
**Dir**: src/application/user-management/use-cases/staff-type/
- create-staff-type.use-case.ts (name unique per campus)
- get-staff-type-by-id.use-case.ts
- get-all-staff-types.use-case.ts (filter by campusId)
- update-staff-type.use-case.ts
- delete-staff-type.use-case.ts (soft delete via isActive)

### 2.3 Update StaffRepository Port
**File**: src/application/user-management/ports/staff.repository.ts
- Update findByType() → findByStaffTypeId()
- Add campusId parameter to find methods (campus-scoped)
- Update type references

### 2.4 Update Staff Use Cases
**File**: src/application/user-management/use-cases/staff/create-staff.use-case.ts
- Change staffType enum → staffTypeId UUID input
- Validate staffTypeId exists and is active
- Auto-assign role from staffType.defaultRoleId if present
- Add campusId to input (required)

**File**: src/application/user-management/use-cases/staff/update-staff.use-case.ts  
- Handle staffTypeId changes
- Update role assignment when staffType changes (use new defaultRoleId)

## Phase 3: Infrastructure Layer

### 3.1 Create StaffType Mapper
**File**: src/infra/persistence/prisma/mapper/prisma-staff-type.mapper.ts
- toDomain(), toPrisma(), toPrismaUpdate(), toDomainArray()
- Include defaultRole relation mapping

### 3.2 Create StaffType Repository
**File**: src/infra/persistence/prisma/repositories/prisma-staff-type.repository.ts  
- Implement StaffTypeRepository port
- Include defaultRole relation in queries
- Use PrismaQueryService for filtering

### 3.3 Update Staff Mapper
**File**: src/infra/persistence/prisma/mapper/prisma-staff.mapper.ts
- Map staffTypeId instead of staffType string
- Add campusId mapping
- Include staffType relation in domain object

### 3.4 Update Staff Repository
**File**: src/infra/persistence/prisma/repositories/prisma-staff.repository.ts
- Update queries to use staffTypeId
- Add campus filtering to all queries
- Include staffType relation

## Phase 4: HTTP Layer

### 4.1 Create StaffType DTOs
**Dir**: src/infra/http/dtos/user-management/staff-type/
- create-staff-type.request.ts (campusId, name, description?, defaultRoleId?, isActive?)
- update-staff-type.request.ts
- staff-type.response.ts (include defaultRole object)

### 4.2 Create StaffType Controller
**File**: src/infra/http/controllers/user-management/staff-type.controller.ts
- POST /staff-types - Create (requires campusId)
- GET /staff-types - List (filter by campus)
- GET /staff-types/:id - Get by ID
- PATCH /staff-types/:id - Update
- DELETE /staff-types/:id - Deactivate

### 4.3 Update Staff DTOs
**File**: src/infra/http/dtos/user-management/staff/create-staff.request.ts
- staffType enum → staffTypeId UUID
- Add campusId (required)

**File**: src/infra/http/dtos/user-management/staff/update-staff.request.ts
- staffType enum → staffTypeId UUID

**File**: src/infra/http/dtos/user-management/staff/staff.response.ts
- Include staffType object instead of string
- Add campusId

### 4.4 Create StaffType Module
**File**: src/infra/http/modules/staff-type.module.ts
- Register controller, use cases, repository
- Export for use by other modules

## Phase 5: Testing

### 5.1 Unit Tests
- StaffType entity tests
- Staff entity tests (updated)
- StaffType use case tests
- Staff use case tests (updated - auto-assign role)

## Key Changes Summary

1. **Domain**: StaffType entity + Staff entity updated
2. **Application**: StaffTypeRepository port + 5 use cases + Staff use cases updated
3. **Infrastructure**: StaffType mapper/repository + Staff mapper/repository updated
4. **HTTP**: StaffType controller + DTOs + Staff DTOs updated
5. **Auto-role**: CreateStaff uses staffType.defaultRoleId for auto-assignment
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Replaced the staff_type enum with a configurable StaffType table that is campus-scoped and supports default role assignment.

## Files Created

### Domain Layer
- src/domain/user-management/entities/staff-type.entity.ts - StaffType entity with validation and domain methods

### Application Layer
- src/application/user-management/ports/staff-type.repository.ts - Repository port interface
- src/application/user-management/use-cases/staff-type/create-staff-type.use-case.ts
- src/application/user-management/use-cases/staff-type/get-staff-type-by-id.use-case.ts
- src/application/user-management/use-cases/staff-type/get-all-staff-types.use-case.ts
- src/application/user-management/use-cases/staff-type/update-staff-type.use-case.ts
- src/application/user-management/use-cases/staff-type/delete-staff-type.use-case.ts

### Infrastructure Layer
- src/infra/persistence/prisma/mapper/prisma-staff-type.mapper.ts
- src/infra/persistence/prisma/repositories/prisma-staff-type.repository.ts

### HTTP Layer
- src/infra/http/dtos/user-management/staff-type/ (create, update, response DTOs)
- src/infra/http/controllers/user-management/staff-type.controller.ts
- src/infra/http/modules/staff-type.module.ts

## Files Modified

### Domain Layer
- src/domain/user-management/entities/staff.entity.ts - Added campusId, changed staffType enum to staffTypeId FK
- src/domain/user-management/enums/staff-type.enum.ts - Marked as @deprecated

### Application Layer
- src/application/user-management/ports/staff.repository.ts - Added campus-scoped methods
- src/application/user-management/use-cases/staff/create-staff.use-case.ts - Uses staffTypeId, auto-assigns defaultRoleId
- src/application/user-management/use-cases/staff/update-staff.use-case.ts - Uses staffTypeId, auto-assigns defaultRoleId

### Infrastructure Layer
- src/infra/persistence/prisma/mapper/prisma-staff.mapper.ts - Maps campusId and staffTypeId
- src/infra/persistence/prisma/repositories/prisma-staff.repository.ts - Campus-scoped queries
- src/infra/persistence/prisma/mapper/index.ts - Added export

### HTTP Layer
- src/infra/http/dtos/user-management/staff/create-staff.request.ts - campusId + staffTypeId
- src/infra/http/dtos/user-management/staff/update-staff.request.ts - staffTypeId
- src/infra/http/dtos/user-management/staff/staff.response.ts - campusId + staffTypeId
- src/infra/http/dtos/user-management/index.ts - Added staff-type export
- src/infra/http/controllers/user-management/staff.controller.ts - Updated for new DTOs
- src/infra/http/http.module.ts - Registered StaffTypeModule

## Key Features
1. StaffType is campus-scoped (unique name per campus)
2. StaffType supports defaultRoleId for auto-assignment when creating Staff
3. Staff entity now has campusId (required) and staffTypeId (optional FK)
4. Staff use cases validate staffType belongs to same campus
5. StaffType enum deprecated with migration guide

## API Endpoints Added
- POST /staff-types - Create staff type
- GET /staff-types - List staff types (paginated)
- GET /staff-types/:id - Get by ID
- PATCH /staff-types/:id - Update
- DELETE /staff-types/:id - Deactivate (soft delete)

✓ Created StaffType entity unit tests (29 tests passing)
<!-- SECTION:NOTES:END -->

