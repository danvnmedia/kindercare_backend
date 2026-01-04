---
title: Use Case Pattern
createdAt: '2026-01-03T19:52:11.456Z'
updatedAt: '2026-01-03T20:06:16.444Z'
description: Business logic encapsulation pattern
tags:
  - patterns
  - use-case
  - application
---
# Use Case Pattern

## Overview

Use cases encapsulate a single business operation. They orchestrate domain entities, repositories, and external services to execute business logic. There are two types: Query (read-only) and Command (write operations).

## Location

src/application/{module}/use-cases/{entity}/{action}-{entity}.use-case.ts

## Use Case Types

### Query Use Case (Read-Only)

Retrieves data without side effects. Examples: GetById, GetAll, List, Search.

### Command Use Case (Write Operations)

Creates, updates, or deletes data. Includes validation, business rules, and side effects.

## Input Interface

Define input types at the top of the use case file:

export interface CreateStaffInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  staffType: StaffType;
  address?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  startDate?: Date;
}

## Structure

1. Log operation start
2. Validate input (business rules)
3. Check preconditions (uniqueness, existence)
4. Create domain entity
5. Persist entity
6. Handle side effects (optional)
7. Log success and return

## Dependency Injection

Repositories and ports are injected using tokens:

constructor(
  @Inject(STAFF_REPOSITORY)
  private readonly staffRepository: StaffRepository,
  @Inject(USER_REPOSITORY)
  private readonly userRepository: UserRepository,
  private readonly identityPort: IdentityPort,
) {}

## Exception Handling

- NotFoundException: Entity not found by ID
- ConflictException: Duplicate/uniqueness violation
- BadRequestException: Invalid input or business rule violation
- ForbiddenException: Authorization failure

## Logging

Always log operation start, success with entity ID, and errors with full stack trace.

## Best Practices

1. Single responsibility: One use case = one operation
2. Private helper methods: Break down complex logic
3. Domain entity creation: Use Entity.create() factory method
4. Transaction handling: Let repository handle transactions
5. No HTTP concerns: Use domain exceptions, not HTTP status codes
6. Validate early: Check input before touching the database
7. Log everything: Entry, success, and failure
