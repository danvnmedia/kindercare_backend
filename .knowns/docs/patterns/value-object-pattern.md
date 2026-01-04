---
title: Value Object Pattern
createdAt: '2026-01-03T19:52:18.069Z'
updatedAt: '2026-01-03T20:28:18.287Z'
description: Immutable value types pattern
tags:
  - patterns
  - value-object
  - domain
---
# Value Object Pattern

> Immutable value types. Located in src/core/value-objects/

---

## Base Class

ValueObject<T> provides:
- Protected readonly props (frozen with Object.freeze)
- equals(vo?: ValueObject<T>): boolean - JSON comparison
- toPlain(): T | Record<string, unknown> - returns props

---

## Common Value Objects

### Email
- Validates email format with regex
- Normalizes to lowercase
- create(email: string): Email
- isValid(email: string): boolean
- toPlain(): returns value string

### PhoneNumber
- Uses libphonenumber-js for validation
- Formats to E.164 format
- create(phone: string, country = 'JP'): PhoneNumber
- isValid(phone: string, country = 'JP'): boolean

### Money
- Prevents negative amounts
- Rounds to 2 decimal places
- create(amount: number, currency = 'JPY'): Money
- add(other: Money): Money - validates same currency

---

## Key Principles

1. **Immutable**: Props are frozen, cannot be modified
2. **Factory method**: Use create() for validation and construction
3. **Static validation**: isValid() for checking without construction
4. **Equality by value**: equals() compares props, not identity
5. **Serialization**: toPlain() for converting to primitive types
