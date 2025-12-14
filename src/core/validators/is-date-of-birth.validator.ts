import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";

/**
 * Date of Birth Validation Options
 */
export interface DateOfBirthOptions {
  /**
   * Minimum age in years (inclusive)
   * @example 18 - Must be at least 18 years old
   */
  minAge?: number;

  /**
   * Maximum age in years (inclusive)
   * @example 100 - Must be at most 100 years old
   */
  maxAge?: number;

  /**
   * Allow future dates (default: false)
   * @default false
   */
  allowFuture?: boolean;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Parse date from various formats
 */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Date of Birth Validator
 *
 * Validates that a date is a valid date of birth with optional age constraints.
 *
 * @example
 * Valid: "1990-01-15", "2010-05-20", new Date("1985-03-20")
 * Invalid: "future-date", "invalid-string", age out of range
 */
@ValidatorConstraint({ name: "isDateOfBirth", async: false })
export class IsDateOfBirthConstraint implements ValidatorConstraintInterface {
  private failureReason: string = "";

  validate(value: unknown, args: ValidationArguments): boolean {
    const options: DateOfBirthOptions = args.constraints[0] || {};
    const { minAge, maxAge, allowFuture = false } = options;

    // Parse the date
    const date = parseDate(value);
    if (!date) {
      this.failureReason = "invalid_date";
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if date is in the future
    if (!allowFuture && date > today) {
      this.failureReason = "future_date";
      return false;
    }

    // Calculate age
    const age = calculateAge(date);

    // Check minimum age
    if (minAge !== undefined && age < minAge) {
      this.failureReason = "too_young";
      return false;
    }

    // Check maximum age
    if (maxAge !== undefined && age > maxAge) {
      this.failureReason = "too_old";
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const options: DateOfBirthOptions = args.constraints[0] || {};
    const { minAge, maxAge } = options;

    switch (this.failureReason) {
      case "invalid_date":
        return "Date of birth must be a valid date";

      case "future_date":
        return "Date of birth cannot be in the future";

      case "too_young":
        return `Must be at least ${minAge} years old`;

      case "too_old":
        return `Must be at most ${maxAge} years old`;

      default:
        return "Invalid date of birth";
    }
  }
}

/**
 * Date of Birth Decorator
 *
 * Validates that a value is a valid date of birth with optional age constraints.
 *
 * @example
 * // Basic usage - just validates it's a past date
 * @IsDateOfBirth()
 * dateOfBirth: Date;
 *
 * @example
 * // Require minimum age of 18
 * @IsDateOfBirth({ minAge: 18 })
 * dateOfBirth: Date;
 *
 * @example
 * // Require age between 3 and 18 (for students)
 * @IsDateOfBirth({ minAge: 3, maxAge: 18 })
 * dateOfBirth: Date;
 *
 * @example
 * // Require age between 18 and 100 (for adults)
 * @IsDateOfBirth({ minAge: 18, maxAge: 100 })
 * dateOfBirth: Date;
 */
export function IsDateOfBirth(
  options?: DateOfBirthOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: "isDateOfBirth",
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: [options || {}],
      validator: IsDateOfBirthConstraint,
    });
  };
}

// ============== Convenience Decorators ==============

/**
 * Validates date of birth for adults (18+ years old)
 *
 * @example
 * @IsAdultDateOfBirth()
 * dateOfBirth: Date;
 */
export function IsAdultDateOfBirth(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return IsDateOfBirth(
    { minAge: 18, maxAge: 120 },
    {
      message: validationOptions?.message || "Must be at least 18 years old",
      ...validationOptions,
    },
  );
}

/**
 * Validates date of birth for children/students (typically 0-18 years old)
 *
 * @example
 * @IsChildDateOfBirth()
 * dateOfBirth: Date;
 *
 * @example
 * // Custom age range for kindergarten
 * @IsChildDateOfBirth({ minAge: 3, maxAge: 6 })
 * dateOfBirth: Date;
 */
export function IsChildDateOfBirth(
  options?: { minAge?: number; maxAge?: number },
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  const { minAge = 0, maxAge = 18 } = options || {};

  return IsDateOfBirth(
    { minAge, maxAge },
    {
      message:
        validationOptions?.message ||
        `Age must be between ${minAge} and ${maxAge} years old`,
      ...validationOptions,
    },
  );
}
