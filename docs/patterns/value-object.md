# Value Object Pattern

> Immutable value types. Located in `src/core/value-objects/`

---

## Base Class

```typescript
export abstract class ValueObject<T> {
  protected readonly props: T;

  protected constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(vo?: ValueObject<T>): boolean {
    if (!vo) return false;
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }

  public toPlain(): T | Record<string, unknown> {
    return this.props;
  }
}
```

---

## Email

```typescript
export class Email extends ValueObject<{ value: string }> {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  get value(): string { return this.props.value; }

  public static create(email: string): Email {
    if (!email) throw new Error('Email is required');
    const trimmed = email.trim().toLowerCase();
    if (!Email.EMAIL_REGEX.test(trimmed)) throw new Error('Invalid email');
    return new Email({ value: trimmed });
  }

  public static isValid(email: string): boolean {
    return Email.EMAIL_REGEX.test(email?.trim() ?? '');
  }

  public toPlain(): string { return this.props.value; }
}
```

---

## PhoneNumber

```typescript
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export class PhoneNumber extends ValueObject<{ value: string; countryCode: string }> {
  get value(): string { return this.props.value; }

  public static create(phone: string, country = 'JP'): PhoneNumber {
    if (!isValidPhoneNumber(phone, country)) throw new Error('Invalid phone');
    const parsed = parsePhoneNumber(phone, country);
    return new PhoneNumber({
      value: parsed.format('E.164'),
      countryCode: parsed.countryCallingCode,
    });
  }

  public static isValid(phone: string, country = 'JP'): boolean {
    try { return isValidPhoneNumber(phone, country); }
    catch { return false; }
  }
}
```

---

## Money

```typescript
export class Money extends ValueObject<{ amount: number; currency: string }> {
  get amount(): number { return this.props.amount; }
  get currency(): string { return this.props.currency; }

  public static create(amount: number, currency = 'JPY'): Money {
    if (amount < 0) throw new Error('Amount cannot be negative');
    return new Money({ amount: Math.round(amount * 100) / 100, currency });
  }

  public add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return Money.create(this.amount + other.amount, this.currency);
  }
}
```
