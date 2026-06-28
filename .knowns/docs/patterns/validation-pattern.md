---
title: Validation Pattern
description: Custom class-validator decorators and class-transformer transforms (E.164 phone, date-of-birth age limits, UTC date transform)
createdAt: '2026-01-03T19:52:41.574Z'
updatedAt: '2026-05-05T17:32:47.514Z'
tags:
  - patterns
  - validation
  - decorators
  - class-validator
---

# Validation Pattern

> Custom validators and transforms. Located at `src/core/validators/`.

The codebase has three custom validation primitives, all built on `class-validator` / `class-transformer`. They run inside the global `ValidationPipe` configured in `main.ts`.

## Inventory

| File | Exports |
|------|---------|
| `is-e164-phone.validator.ts` | `@IsE164Phone(opts)`, `@IsVietnamesePhone()` |
| `is-date-of-birth.validator.ts` | `@IsDateOfBirth(opts)`, `@IsAdultDateOfBirth()`, `@IsChildDateOfBirth(opts)` |
| `transform-to-utc-date.transformer.ts` | `@TransformToUTCDate()`, `@IsISO8601Date()`, `parseToUTCDate(value)` |

Re-exported from `@/core/validators`.

## `@IsE164Phone(options?)`

Validates the **E.164** international format: `+` followed by 1–14 digits, country code 1–9.

```typescript
class CreateStaffRequest {
  @IsE164Phone()
  phoneNumber: string;                 // accepts +84912345678, +14155552671

  @IsE164Phone({ allowedCountryCodes: ["84"] })
  vnPhone: string;                     // Vietnamese only

  @IsVietnamesePhone()                 // alias with min 9 / max 10 subscriber length
  altPhone: string;
}
```

| Option | Default | Notes |
|--------|---------|-------|
| `allowedCountryCodes` | undefined | If set, the prefix must match one of these |
| `minSubscriberLength` | 7 | Digits after the country code |
| `maxSubscriberLength` | 12 | Total length capped at 15 by E.164 |

## `@IsDateOfBirth(options?)`

Validates a date is **a valid date** with optional age constraints. Uses UTC to avoid server-timezone drift.

```typescript
class CreateGuardianRequest {
  @TransformToUTCDate()
  @IsAdultDateOfBirth()                // minAge: 18, maxAge: 120
  dateOfBirth?: Date;
}

class CreateStudentRequest {
  @TransformToUTCDate()
  @IsChildDateOfBirth({ minAge: 3, maxAge: 6 })  // kindergarten range
  dateOfBirth?: Date;
}
```

| Option | Default | Effect |
|--------|---------|--------|
| `minAge` | undefined | Reject if calculated age < minAge |
| `maxAge` | undefined | Reject if calculated age > maxAge |
| `allowFuture` | `false` | Allow dates after today |

The error message reflects the failure reason: `"future_date"`, `"too_young"`, `"too_old"`, `"invalid_date"`.

## `@TransformToUTCDate()` and `@IsISO8601Date()`

Date handling is the trickiest part of the validation layer. The codebase enforces:

- **Storage**: UTC at midnight for date-only fields, full UTC timestamp for timestamps.
- **Wire format**: ISO 8601 with `Z` suffix or no offset (treated as UTC).

Use both decorators on date inputs:

```typescript
class CreateEventRequest {
  @TransformToUTCDate()                // pre-validation: parse string → Date in UTC
  @IsISO8601Date()                     // validation: must look like ISO 8601
  eventDate: Date;
}
```

`parseToUTCDate(value)` accepts:

- `"2020-05-15"` → `2020-05-15T00:00:00.000Z`
- `"2020-05-15T10:00:00.000Z"` → preserved
- `"2020-05-15T10:00:00"` (no offset) → treated as UTC
- A `Date` instance → passed through

## Pairing with Built-in Validators

```typescript
@IsString()
@IsNotEmpty()
@MinLength(2)
@MaxLength(100)
fullName: string;

@IsOptional()
@IsEmail({}, { message: "Invalid email format" })
email?: string;

@IsOptional()
@IsString()
@IsE164Phone()
phoneNumber?: string;

@IsOptional()
@TransformToUTCDate()
@IsDateOfBirth({ minAge: 0, maxAge: 18 })
dateOfBirth?: Date;
```

`@IsOptional()` must come first so the other validators don't fire when the field is absent.

## Writing a New Validator

1. Implement `ValidatorConstraintInterface` with `validate()` and `defaultMessage()`.
2. Register it with `@ValidatorConstraint({ name: "...", async: false })`.
3. Export a decorator function that calls `registerDecorator(...)`.

```typescript
@ValidatorConstraint({ name: "isStartOfMonth", async: false })
export class IsStartOfMonthConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!(value instanceof Date)) return false;
    return value.getUTCDate() === 1;
  }
  defaultMessage(): string {
    return "Date must be the first day of the month (UTC)";
  }
}

export function IsStartOfMonth(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: "isStartOfMonth",
      target: object.constructor,
      propertyName: propertyName as string,
      options,
      validator: IsStartOfMonthConstraint,
    });
  };
}
```

Add the decorator to `src/core/validators/index.ts` so it's importable from `@/core/validators`.

## Best Practices

1. **Validate at the DTO**, not in the use case. The pipe runs before any handler executes.
2. **Use `@TransformToUTCDate` on every date input.** Strings come in many shapes; the transform normalises them.
3. **Don't pre-format phone numbers in the use case** — the DTO already enforces E.164 strictness, so use cases can trust the input.
4. **Keep validators synchronous (`async: false`).** Async validators can't share state with the request flow and slow down rejections.
