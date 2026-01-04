---
title: Entity Pattern
createdAt: '2026-01-03T19:52:16.385Z'
updatedAt: '2026-01-03T20:27:39.295Z'
description: Domain entity structure pattern
tags:
  - patterns
  - entity
  - domain
---
# Entity Pattern

> Domain entities. Located in src/domain/{module}/

---

## Base Entity

Located in src/core/entities/entity.ts

The base Entity class provides:
- Protected props for entity data
- Protected _id as UniqueEntityID
- Getter for id (returns string)
- toPlain() method for serialization

---

## Domain Entity

Domain entities follow a standard structure:

1. **Props interface**: All properties organized in a dedicated interface
2. **Getters**: Provide read-only access to properties for encapsulation
3. **Domain methods**: Business logic that operates on entity state
4. **Factory method**: create() method with sensible defaults
5. **Enums**: Define standardized values for specific fields
6. **Archival pattern**: Support soft deletion with isArchived flag
7. **Timestamps**: Include createdAt and updatedAt for audit trail

---

## Key Patterns

1. Props interface defines the structure of entity data
2. Getters provide read-only access to properties for encapsulation
3. Domain methods contain business logic (archive, unarchive, updateInfo)
4. Static validation methods contain validation rules outside the entity class
5. Factory method create() with sensible defaults and proper initialization
6. Enums define standardized values for specific fields
7. Archival pattern supports soft deletion with isArchived flag
8. Timestamps include createdAt and updatedAt for audit trail
9. Immutable by design - properties accessed via getters, not directly
10. Domain-focused - methods represent business operations, not data access
