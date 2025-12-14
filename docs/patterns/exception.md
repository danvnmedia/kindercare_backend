# Exception Pattern

> Error handling. Located in `src/core/exceptions/`

---

## Response Format

```json
{
  "message": "Username not found",
  "error_code": "not_found",
  "error": {
    "field": "username",
    "value": "john_doe",
    "reason": "User does not exist in the system"
  }
}
```

---

## Base Exception

```typescript
import { HttpException } from '@nestjs/common';

export interface ErrorDetails {
  field?: string;
  value?: unknown;
  reason?: string;
  [key: string]: unknown;
}

export abstract class DomainException extends HttpException {
  abstract readonly errorCode: string;
  readonly errorDetails?: ErrorDetails;

  constructor(message: string, statusCode: number, errorDetails?: ErrorDetails) {
    super(message, statusCode);
    this.errorDetails = errorDetails;
  }
}
```

---

## Examples

```typescript
import { HttpStatus } from '@nestjs/common';

export class EntityNotFoundException extends DomainException {
  readonly errorCode = 'not_found';
  constructor(entity: string, id?: string) {
    super(
      `${entity} not found`,
      HttpStatus.NOT_FOUND,
      { field: 'id', value: id, reason: `${entity} does not exist` },
    );
  }
}

export class EmailAlreadyExistsException extends DomainException {
  readonly errorCode = 'email_already_exists';
  constructor(email: string) {
    super(
      `Email is already registered`,
      HttpStatus.CONFLICT,
      { field: 'email', value: email, reason: 'Email must be unique' },
    );
  }
}

export class InvalidOrderStatusException extends DomainException {
  readonly errorCode = 'invalid_order_status';
  constructor(current: string, target: string) {
    super(
      `Cannot transition order status`,
      HttpStatus.BAD_REQUEST,
      { currentStatus: current, targetStatus: target, reason: 'Invalid transition' },
    );
  }
}

export class ValidationException extends DomainException {
  readonly errorCode = 'validation_error';
  constructor(errors: Record<string, string[]>) {
    super(
      'Validation failed',
      HttpStatus.BAD_REQUEST,
      { errors },
    );
  }
}
```

---

## Categories

| Category | Status | error_code | Use Case |
|----------|--------|------------|----------|
| NotFound | 404 | `not_found` | Entity not found |
| Conflict | 409 | `already_exists` | Duplicate data |
| BadRequest | 400 | `validation_error` | Invalid input |
| Forbidden | 403 | `forbidden` | No permission |
| Unauthorized | 401 | `unauthorized` | Auth required |

---

## Global Filter

Located in `src/core/filters/global-exception.filter.ts`

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'internal_error';
    let message = 'Internal server error';
    let errorDetails: ErrorDetails | undefined;

    if (exception instanceof DomainException) {
      status = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
      errorDetails = exception.errorDetails;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    response.status(status).json({
      message,
      error_code: errorCode,
      error: errorDetails ?? null,
    });
  }
}
```
