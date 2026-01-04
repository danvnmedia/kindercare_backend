---
title: Validation Pattern
createdAt: '2026-01-03T19:52:41.574Z'
updatedAt: '2026-01-03T20:29:29.949Z'
description: Custom validators pattern
tags:
  - patterns
  - validation
  - decorators
---
# Validation Pattern

> Custom validators. Located in src/core/decorators/validation/

---

## Creating Custom Validators

1. Create constraint class implementing ValidatorConstraintInterface
2. Add @ValidatorConstraint({ async: false }) decorator
3. Implement validate(value): boolean
4. Implement defaultMessage(): string
5. Create decorator function using registerDecorator

---

## Email Validator

IsValidEmailConstraint:
- Validates value is string
- Uses Email.isValid() from value object
- Returns 'Invalid email format' on failure

@IsValidEmail() decorator applies this validation.

---

## Phone Validator

IsPhoneNumberConstraint:
- Validates value is string
- Uses PhoneNumber.isValid() from value object
- Returns 'Invalid phone number format' on failure

@IsPhoneNumber() decorator applies this validation.

---

## Usage in DTOs

Apply validators to DTO properties:
- @IsValidEmail() email: string
- @IsPhoneNumber() phoneNumber: string
- Combine with standard validators like @IsString(), @MinLength()

---

## Key Principles

1. Leverage value object validation logic
2. Return clear error messages
3. Keep validators focused on single concern
4. Use async: false for synchronous validation
5. Combine with class-validator decorators
