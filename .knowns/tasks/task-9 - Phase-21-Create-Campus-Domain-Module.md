---
id: '9'
title: 'Phase 2.1: Create Campus Domain Module'
status: done
priority: high
labels:
  - domain
  - campus
  - clean-architecture
  - phase-2
createdAt: '2026-01-06T04:27:24.940Z'
updatedAt: '2026-01-06T23:12:40.559Z'
timeSpent: 2711
assignee: '@me'
---
# Phase 2.1: Create Campus Domain Module

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the Campus domain module following clean architecture patterns established in the codebase.

Depends on @task-8 (Prisma schema must be migrated first).
See @doc/migrations/multi-campus-migration for context.
See @doc/patterns/entity-pattern for entity patterns.
See @doc/patterns/repository-pattern for repository patterns.

## Domain Layer

### Entity: Campus
**File**: src/domain/campus/entities/campus.entity.ts
- Properties: name, address, phoneNumber, isActive
- Factory method: Campus.create(props, id?)
- Domain methods: update(), activate(), deactivate()
- Validation: name required, phoneNumber E.164 format

### Value Objects (if needed)
- Consider PhoneNumber value object reuse

## Application Layer

### Repository Port
**File**: src/application/campus/ports/campus.repository.ts
- findById(id): Promise<Campus | null>
- findByName(name): Promise<Campus | null>
- findAll(params: StandardRequest): Promise<PaginatedResult<Campus>>
- save(campus: Campus): Promise<Campus>
- update(campus: Campus): Promise<Campus>
- delete(id: string): Promise<void>
- exists(id: string): Promise<boolean>

### Use Cases
**Files**: src/application/campus/use-cases/
- create-campus.use-case.ts
- get-campus-by-id.use-case.ts
- get-all-campuses.use-case.ts
- update-campus.use-case.ts
- delete-campus.use-case.ts (soft delete via isActive=false)

## Infrastructure Layer

### Prisma Repository
**File**: src/infra/persistence/prisma/repositories/prisma-campus.repository.ts
- Implements CampusRepository port
- Uses PrismaQueryService for filtering/pagination

### Mapper
**File**: src/infra/persistence/prisma/mapper/prisma-campus.mapper.ts
- toDomain(), toPrisma(), toPrismaUpdate()

## HTTP Layer

### Controller
**File**: src/infra/http/controllers/campus.controller.ts
- POST /campuses - Create campus
- GET /campuses - List campuses
- GET /campuses/:id - Get campus
- PATCH /campuses/:id - Update campus
- DELETE /campuses/:id - Deactivate campus

### DTOs
**Files**: src/infra/http/dtos/campus/
- create-campus.request.ts
- update-campus.request.ts
- campus.response.ts

### Module
**File**: src/infra/http/modules/campus.module.ts
- Register controller, use cases, repository
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Campus entity created with proper validation and domain methods
- [x] #2 CampusRepository port interface defined
- [x] #3 All 5 use cases created (CRUD + list)
- [x] #4 Prisma repository implementation created
- [x] #5 Prisma mapper created with all mapping methods
- [x] #6 Controller created with all endpoints
- [x] #7 Request/Response DTOs created with validation
- [x] #8 CampusModule configured and registered in HttpModule
- [x] #9 Unit tests created for entity and use cases
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create domain entity: src/domain/campus/entities/campus.entity.ts
   - Extend Entity base class
   - Properties: name, address, phoneNumber, isActive
   - Factory method with validation
   - Domain methods: update(), activate(), deactivate()

2. Create repository port: src/application/campus/ports/campus.repository.ts
   - Define abstract class with standard CRUD methods
   - Add exists(id) method for validation

3. Create use cases: src/application/campus/use-cases/
   - create-campus.use-case.ts
   - get-campus-by-id.use-case.ts  
   - get-all-campuses.use-case.ts
   - update-campus.use-case.ts
   - delete-campus.use-case.ts (soft delete via isActive)

4. Create Prisma mapper: src/infra/persistence/prisma/mapper/prisma-campus.mapper.ts
   - toDomain(), toPrisma(), toPrismaUpdate()

5. Create Prisma repository: src/infra/persistence/prisma/repositories/prisma-campus.repository.ts
   - Implement CampusRepository port
   - Use PrismaQueryService for filtering

6. Create DTOs: src/infra/http/dtos/campus/
   - create-campus.request.ts (validation decorators)
   - update-campus.request.ts
   - campus.response.ts (@Expose decorators)

7. Create controller: src/infra/http/controllers/campus.controller.ts
   - CRUD endpoints with @StandardResponse

8. Create module: src/infra/http/modules/campus.module.ts
   - Register all providers
   - Add to HttpModule imports

9. Write unit tests for entity and use cases
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Created the Campus domain module following clean architecture patterns established in the codebase.

## Files Created

### Domain Layer
- src/domain/campus/entities/campus.entity.ts
  - Props: name, address, phoneNumber, isActive, createdAt, updatedAt
  - Factory method with validation (name required, phoneNumber E.164 format)
  - Domain methods: update(), activate(), deactivate()

### Application Layer
- src/application/campus/ports/campus.repository.ts
  - Abstract class with standard CRUD methods
  - findById, findByName, findAll (paginated), save, update, delete, exists

- src/application/campus/use-cases/
  - create-campus.use-case.ts (with name uniqueness check)
  - get-campus-by-id.use-case.ts
  - get-all-campuses.use-case.ts (paginated)
  - update-campus.use-case.ts (with name uniqueness check)
  - delete-campus.use-case.ts (soft delete via isActive=false)

### Infrastructure Layer
- src/infra/persistence/prisma/mapper/prisma-campus.mapper.ts
  - toDomain, toPrisma, toPrismaUpdate, toDomainArray

- src/infra/persistence/prisma/repositories/prisma-campus.repository.ts
  - Uses PrismaQueryService for filtering/pagination
  - Allowed filters: name, address, phoneNumber, isActive

### HTTP Layer
- src/infra/http/dtos/campus/
  - create-campus.request.ts (validation decorators)
  - update-campus.request.ts
  - campus.response.ts (@Expose decorators)

- src/infra/http/controllers/campus.controller.ts
  - POST /campuses - Create campus
  - GET /campuses - List campuses (paginated)
  - GET /campuses/:id - Get by ID
  - PATCH /campuses/:id - Update
  - DELETE /campuses/:id - Deactivate (soft delete)

- src/infra/http/modules/campus.module.ts
  - Exports CAMPUS_REPOSITORY for other modules

### Tests (40 tests passing)
- src/domain/campus/entities/campus.entity.spec.ts
- src/application/campus/use-cases/*.spec.ts

## Configuration Changes
- Updated package.json jest config with moduleNameMapper for @/ path alias
- Registered CampusModule in HttpModule
<!-- SECTION:NOTES:END -->

