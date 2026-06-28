---
title: Exception Pattern
description: Error handling using NestJS HTTP exceptions, with module-specific domain exceptions for select cases
createdAt: '2026-01-03T19:52:31.870Z'
updatedAt: '2026-05-05T17:31:40.813Z'
tags:
  - patterns
  - exception
  - error
  - http
---

# Exception Pattern

> Error handling. The codebase uses NestJS built-in HTTP exceptions in use cases and controllers; a small set of framework-agnostic domain exceptions live alongside specific entities.

## TL;DR

| Layer | What to throw |
|-------|---------------|
| Use case | NestJS exceptions: `BadRequestException`, `ConflictException`, `ForbiddenException`, `NotFoundException`, `UnauthorizedException` |
| Domain entity / factory | Plain `Error` (use case catches and wraps) — **or** an existing module-specific exception class |
| External adapters (e.g. Clerk) | Bubble up errors; the use case wraps them in `BadRequestException` or `ConflictException` |
| Repositories | Let Prisma errors bubble up; do not invent domain meaning here |

There is **no global `DomainException` base class** and **no `src/core/exceptions/` directory**. NestJS's `ValidationPipe` (configured in `main.ts` with `whitelist: true, forbidNonWhitelisted: true, transform: true`) handles request-validation errors automatically.

## Mapping Errors to HTTP Status

| When | Throw | HTTP |
|------|-------|------|
| Entity not found by ID, or campus filter excludes it | `NotFoundException("Student with ID … not found")` | 404 |
| Duplicate value (email, phone, name) within campus | `ConflictException("Student with email … already exists in this campus")` | 409 |
| Invalid input or business-rule violation | `BadRequestException("Class does not belong to this campus")` | 400 |
| Authentication missing | `UnauthorizedException("Authentication required")` | 401 |
| User authenticated but lacks access | `ForbiddenException("No access to this campus")` | 403 |

## Throwing in Use Cases

```typescript
async execute(input: CreateStudentInput): Promise<Student> {
  // Existence check
  if (input.guardianIds?.length) {
    const guardians = await this.guardianRepository.findByIds(input.guardianIds);
    const missing = input.guardianIds.filter(id => !guardians.find(g => g.id === id));
    if (missing.length) {
      throw new NotFoundException(`Guardians not found: ${missing.join(", ")}`);
    }
  }

  // Uniqueness check
  if (input.email) {
    const existing = await this.studentRepository.findByEmailInCampus(
      input.campusId, input.email,
    );
    if (existing) {
      throw new ConflictException(
        `Student with email ${input.email} already exists in this campus`,
      );
    }
  }

  // Domain factory throws plain Error → wrap as BadRequest
  try {
    const student = Student.create({ ... });
  } catch (error) {
    throw new BadRequestException(error.message);
  }
}
```

The convention is to **let known NestJS exceptions pass through** and **wrap unknown errors in `BadRequestException`**. See `CreateStudentUseCase.execute` for the canonical structure:

```typescript
try {
  // …
} catch (error) {
  if (
    error instanceof ConflictException ||
    error instanceof NotFoundException ||
    error instanceof BadRequestException
  ) {
    throw error;
  }
  throw new BadRequestException(error.message);
}
```

## Domain Entity Validation

Domain entities throw plain `Error` from `create()` and from invariant methods. The use case catches and re-throws as `BadRequestException`.

```typescript
// domain/user-management/entities/student.entity.ts
public static create(props, id?): Student {
  if (!props.campusId) {
    throw new Error("Campus ID is required for student.");
  }
  if (!props.fullName || props.fullName.trim().length < 2) {
    throw new Error("Full name is required and must be at least 2 characters.");
  }
  // …
}
```

This keeps the domain layer **framework-agnostic** — `Error` ships with the language and has no dependency on NestJS.

## Module-Specific Domain Exceptions

A few entities ship lightweight exception classes alongside them in `src/domain/{module}/exceptions/`:

```
src/domain/user-management/exceptions/
  email-already-exists.exception.ts
  invalid-user-data.exception.ts
  phone-already-exists.exception.ts
  role-not-found.exception.ts
  student-not-found.exception.ts
  user-not-found.exception.ts
```

Each is a thin `extends Error` that gives the use case a typed signal:

```typescript
export class EmailAlreadyExistsException extends Error {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.name = "EmailAlreadyExistsException";
  }
}
```

Use cases can `catch (e) { if (e instanceof EmailAlreadyExistsException) throw new ConflictException(e.message); }`. Most code paths just throw NestJS exceptions directly and skip the domain-exception layer — both styles are present in the codebase. New code should prefer NestJS exceptions unless a typed signal across multiple use cases is needed.

## Validation Pipe

Request DTOs validated with `class-validator` rely on the global `ValidationPipe` configured in `main.ts`:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // strip unknown fields
    forbidNonWhitelisted: true, // 400 on unknown fields instead of stripping silently
    transform: true,            // run @Type / @Transform decorators
    transformOptions: { enableImplicitConversion: true },
  }),
);
```

A failed validation returns a 400 with the `class-validator` error array — no custom code required.

## Standard Response Format

`StandardResponseInterceptor` only wraps **successful** responses. Errors are returned in NestJS's default shape (`{ statusCode, message, error }`). There is no global error filter — keep error messages descriptive enough for the frontend to display them.

## Best Practices

1. **Prefer NestJS exceptions in use cases.** They map cleanly to HTTP status without ceremony.
2. **Throw plain `Error` in domain entities.** Domain stays framework-free.
3. **Wrap unknown errors as `BadRequestException`.** Don't let raw `Error` reach the HTTP layer with status 500.
4. **Use `ConflictException` for "duplicate", `NotFoundException` for "missing", `BadRequestException` for "invalid combination".**
5. **Let the `ValidationPipe` handle DTO-level errors.** Don't duplicate format checks in the use case.
6. **Don't catch and swallow.** Compensating actions (Clerk rollback, queue cleanup) should `logger.error` and continue, but the original error must still surface.
