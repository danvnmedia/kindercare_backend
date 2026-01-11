---
title: Use Case Pattern
createdAt: '2026-01-03T19:52:11.456Z'
updatedAt: '2026-01-11T05:37:34.477Z'
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



## Campus Context in Use Cases

All campus-scoped use cases must include campusId in their input interface and validate campus ownership.

### Input Interface Pattern

Include campusId as a required field:

```typescript
export interface CreateStudentInput {
  campusId: string;  // Required - always first
  fullName: string;
  email?: string;
  // ... other fields
}

export interface GetAllClassesInput {
  campusId: string;
  params: StandardRequest;
}
```

### Campus Validation Pattern

Always validate that related entities belong to the same campus:

```typescript
async execute(input: CreateClassInput): Promise<Class> {
  // Step 1: Validate grade level exists
  const gradeLevel = await this.gradeLevelRepository.findById(input.gradeLevelId);
  if (!gradeLevel) {
    throw new NotFoundException('Grade level not found');
  }

  // Step 2: Validate campus ownership
  if (gradeLevel.campusId !== input.campusId) {
    throw new BadRequestException('Grade level does not belong to this campus');
  }

  // Step 3: Continue with other validations...
}
```

### Cross-Campus Prevention Pattern

Prevent cross-campus data access in operations involving multiple entities:

```typescript
async execute(input: EnrollStudentInput): Promise<Enrollment> {
  // Validate class belongs to campus
  const classEntity = await this.classRepository.findById(input.classId);
  if (classEntity.campusId !== input.campusId) {
    throw new BadRequestException('Class does not belong to this campus');
  }

  // Validate student belongs to SAME campus
  const student = await this.studentRepository.findById(input.studentId);
  if (student.campusId !== input.campusId) {
    throw new BadRequestException('Cannot enroll student from different campus');
  }
}
```

### Campus-Scoped Uniqueness Checks

Use campus-scoped repository methods for uniqueness validation:

```typescript
private async checkStaffUniqueness(input: CreateStaffInput): Promise<void> {
  // Check email uniqueness WITHIN campus
  const existingByEmail = await this.staffRepository.findByEmailInCampus(
    input.campusId,
    input.email,
  );
  if (existingByEmail) {
    throw new ConflictException(
      `Staff with email ${input.email} already exists in this campus`,
    );
  }
}
```

### Filter Injection Pattern

For list operations, inject campusId into the filter:

```typescript
async execute(input: GetAllStudentsInput): Promise<PaginatedResult<Student>> {
  const { campusId, params } = input;

  if (!campusId) {
    throw new BadRequestException('Campus ID is required');
  }

  // Parse existing filter
  let existingFilter = {};
  if (params.filter) {
    existingFilter = JSON.parse(params.filter);
  }

  // Inject campus filter
  const scopedFilter = {
    ...existingFilter,
    campusId: { eq: campusId },
  };

  const scopedParams: StandardRequest = {
    ...params,
    filter: JSON.stringify(scopedFilter),
  };

  return await this.studentRepository.findAll(scopedParams);
}
```

### Validation Order (Short-Circuit)

Always validate campus context first before other checks:

1. Validate context entity (e.g., class) belongs to campus
2. Validate related entities belong to same campus
3. Validate business rules
4. Create/update entity
