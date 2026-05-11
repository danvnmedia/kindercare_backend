---
title: Value Object Pattern
description: Base ValueObject class for immutable, value-equal types. Currently only the base abstraction is in active use; concrete VOs are intentionally minimal.
createdAt: '2026-01-03T19:52:18.069Z'
updatedAt: '2026-05-05T17:32:09.832Z'
tags:
  - patterns
  - value-object
  - domain
---

# Value Object Pattern

> Immutable value types. Located at `src/core/value-objects/`.

## Status in this Codebase

The codebase ships only the base `ValueObject<T>` abstraction. There are **no concrete value objects** (no `Email`, `PhoneNumber`, `Money`, etc.) in active use. Email and phone validation lives in **DTO-level validators** (see [@doc/patterns/validation-pattern](patterns/validation-pattern)) rather than VOs.

This is a deliberate choice: most fields are simple primitives, and putting an `Email` VO in domain props complicates Prisma mapping for limited gain. Reach for a value object when the type carries non-trivial behaviour (formatting, arithmetic, comparison rules) — not for "this string must look like an email".

## Base Class

`src/core/value-objects/value-object.ts`

```typescript
export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) return false;
    if (vo.props === undefined) return false;
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  public get value(): T {
    return this.props;
  }

  public toPlain(): T | Record<string, unknown> { /* … walks nested VOs … */ }

  public toString(): string { /* … */ }
}
```

Key contract:

- **Immutable** — props are frozen on construction.
- **Value equality** — compared via `JSON.stringify(this.props) === JSON.stringify(other.props)`.
- **Serializable** — `toPlain()` recursively unwraps nested `ValueObject` instances, so the `StandardResponseInterceptor` can render them.

## When to Add a Concrete Value Object

Add one when **all** of these are true:

1. The value has non-trivial behaviour beyond storage (e.g. `Money.add(other: Money)` with currency check).
2. The behaviour is reused across multiple entities or use cases.
3. Constructing an invalid instance should be impossible (the factory throws).

If you only need format validation, prefer a `class-validator` decorator on the DTO.

### Skeleton

```typescript
import { ValueObject } from "@/core/value-objects";

interface MoneyProps {
  amount: number;
  currency: string;
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  public static create(amount: number, currency: string = "VND"): Money {
    if (amount < 0) throw new Error("Money amount cannot be negative");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be ISO 4217");
    return new Money({ amount: Math.round(amount * 100) / 100, currency });
  }

  public add(other: Money): Money {
    if (this.props.currency !== other.props.currency) {
      throw new Error("Cannot add different currencies");
    }
    return Money.create(this.props.amount + other.props.amount, this.props.currency);
  }

  public get amount(): number { return this.props.amount; }
  public get currency(): string { return this.props.currency; }

  public toPlain(): { amount: number; currency: string } {
    return { ...this.props };
  }
}
```

## Persistence Considerations

If you store a value object on an entity, you have two choices:

1. **Inline columns** — the entity props hold the VO, but the mapper reads/writes primitive columns (`amount`, `currency`). The VO only lives in memory.
2. **JSON column** — store `vo.toPlain()` and rehydrate via `VO.create(...)` in the mapper.

Inline columns are the default. JSON is reserved for things like rich-text post content (which is why `Post.content` is `Json` in Prisma but plain `Record<string, unknown>` in the entity — see `Post.entity.ts`).

## Best Practices

1. **Don't add a VO just for validation.** Use DTO validators instead.
2. **Always go through `ValueObject<T>.create()`.** Constructors should be private.
3. **Keep VOs serializable.** Override `toPlain()` if the default output is too nested.
4. **Don't put VOs in `Prisma.*Input` types.** Convert to primitives in the mapper.
