# Validation Pattern

> Custom validators. Located in `src/core/decorators/validation/`

---

## Email Validator

```typescript
@ValidatorConstraint({ async: false })
export class IsValidEmailConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;
    return Email.isValid(value);
  }

  defaultMessage(): string {
    return 'Invalid email format';
  }
}

export function IsValidEmail(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsValidEmailConstraint,
    });
  };
}
```

---

## Phone Validator

```typescript
@ValidatorConstraint({ async: false })
export class IsPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (typeof value !== 'string') return false;
    return PhoneNumber.isValid(value);
  }

  defaultMessage(): string {
    return 'Invalid phone number format';
  }
}

export function IsPhoneNumber(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsPhoneNumberConstraint,
    });
  };
}
```

---

## Usage

```typescript
export class CreateUserRequest {
  @ApiProperty()
  @IsValidEmail()
  email: string;

  @ApiProperty()
  @IsPhoneNumber()
  phoneNumber: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;
}
```
