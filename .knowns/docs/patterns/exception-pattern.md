---
title: Exception Pattern
createdAt: '2026-01-03T19:52:31.870Z'
updatedAt: '2026-01-03T20:27:58.701Z'
description: Error handling pattern with DomainException
tags:
  - patterns
  - exception
  - error
---
# Exception Pattern

> Error handling. Located in src/core/exceptions/

---

## Response Format

All domain exceptions return a consistent format:
- message: Human-readable error message
- error_code: Machine-readable error code
- error: Optional error details (field, value, reason)

---

## Base Exception

DomainException extends HttpException with:
- abstract readonly errorCode: string
- readonly errorDetails?: ErrorDetails

ErrorDetails interface includes:
- field?: string
- value?: unknown
- reason?: string
- [key: string]: unknown (for custom fields)

---

## Categories

| Category | Status | error_code | Use Case |
|----------|--------|------------|----------|
| NotFound | 404 | not_found | Entity not found |
| Conflict | 409 | already_exists | Duplicate data |
| BadRequest | 400 | validation_error | Invalid input |
| Forbidden | 403 | forbidden | No permission |
| Unauthorized | 401 | unauthorized | Auth required |

---

## Common Exceptions

1. **EntityNotFoundException**: 404, entity not found by ID
2. **EmailAlreadyExistsException**: 409, duplicate email
3. **InvalidOrderStatusException**: 400, invalid state transition
4. **ValidationException**: 400, validation failed

---

## Global Filter

Located in src/core/filters/global-exception.filter.ts

The global filter catches all exceptions and formats them consistently:
- DomainException: Uses errorCode and errorDetails
- HttpException: Uses status and message
- Other: Returns 500 internal_error
