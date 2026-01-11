---
title: Repository Pattern
createdAt: '2026-01-03T19:52:13.114Z'
updatedAt: '2026-01-11T05:35:38.690Z'
description: Data access abstraction pattern
tags:
  - patterns
  - repository
  - persistence
---
# Repository Pattern

## Overview

The repository pattern provides a clean abstraction for data access. It consists of a Port (abstract class defining the contract) in the application layer and an Implementation using Prisma in the infrastructure layer.

## Locations

- Port: src/application/{module}/ports/{entity}.repository.ts
- Implementation: src/infra/persistence/prisma/repositories/prisma-{entity}.repository.ts

## Port (Abstract Class)

Defines the contract for data access. Located in the application layer to maintain dependency inversion.

The port is an abstract class with methods like:
- findById(id: string): Promise<Entity | null>
- findByEmail(email: string): Promise<Entity | null>
- findAll(params: StandardRequest): Promise<PaginatedResult<Entity>>
- save(entity: Entity): Promise<Entity>
- update(entity: Entity): Promise<Entity>
- delete(id: string): Promise<void>

## Standard Methods

Every repository should implement these core methods:

1. findById - Find by primary key
2. findAll - Paginated list with filtering and sorting
3. save - Create new entity
4. update - Update existing entity
5. delete - Delete by ID

## Implementation (Prisma)

The Prisma implementation uses PrismaService and PrismaQueryService. Key patterns:

1. Use mapper.toDomain for queries with includes
2. Use mapper.toDomainSimple for simple queries
3. Use mapper.toPrisma for save operations
4. Use mapper.toPrismaUpdate for update operations

For findAll, set allowedFilterFields and allowedSortFields on params, then use queryService.executeQuery.

## Dependency Injection

Register in module providers:
provide: 'STAFF_REPOSITORY', useClass: PrismaStaffRepository

Inject in use cases:
@Inject('STAFF_REPOSITORY') private readonly staffRepository: StaffRepository

## PrismaQueryService

Use for standardized pagination, filtering, and sorting. It takes the Prisma client, model name, StandardRequest params, include options, and mapper class.

## Best Practices

1. Return domain entities, not Prisma models
2. Use toDomain for methods with includes, toDomainSimple without
3. Define allowedFilterFields and allowedSortFields for findAll
4. Always include necessary relations in queries
5. Let mapper handle all Prisma to domain conversion
6. Use abstract class (not interface) for ports



## Campus-Filtered Query Patterns

In the multi-campus architecture, repositories must filter data by campus. All campus-scoped entities have a \ property.

### Pattern 1: Campus-Scoped Find Methods

Add methods that accept campusId for campus-scoped lookups:

\
### Pattern 2: Compound Key Lookups

Use Prisma compound unique constraints for efficient campus-scoped lookups:

\
### Pattern 3: Paginated Campus-Scoped Queries

Use PrismaQueryService with mandatory campus filter:

\
### Pattern 4: Global vs Campus-Scoped Entities

Some entities (like Role) can be global or campus-scoped:

\
### Campus Validation in Repositories

Repositories should NOT validate campus access - that's the use case's responsibility. Repositories simply filter by the campusId provided.
