import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";

/**
 * E.164 Phone Number Format Options
 */
export interface E164PhoneOptions {
  /**
   * Allowed country codes. If not specified, all country codes are allowed.
   * @example ["84"] for Vietnam only
   * @example ["84", "1"] for Vietnam and USA
   */
  allowedCountryCodes?: string[];

  /**
   * Minimum length of subscriber number (digits after country code)
   * @default 7
   */
  minSubscriberLength?: number;

  /**
   * Maximum length of subscriber number (digits after country code)
   * @default 12
   */
  maxSubscriberLength?: number;
}

/**
 * E.164 Phone Number Validator
 *
 * E.164 format: +[country code][subscriber number]
 * - Starts with '+'
 * - Country code: 1-3 digits
 * - Subscriber number: remaining digits
 * - Total: maximum 15 digits (excluding '+')
 *
 * @example
 * Valid: +84912345678, +14155552671, +442071234567
 * Invalid: 84912345678, +84-912-345-678, +84 912 345 678
 */
@ValidatorConstraint({ name: "isE164Phone", async: false })
export class IsE164PhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== "string") {
      return false;
    }

    const options: E164PhoneOptions = args.constraints[0] || {};
    const {
      allowedCountryCodes,
      minSubscriberLength = 7,
      maxSubscriberLength = 12,
    } = options;

    // E.164 format: starts with '+' followed by digits only
    // Maximum 15 digits total (excluding '+')
    const e164Regex = /^\+[1-9]\d{1,14}$/;

    if (!e164Regex.test(value)) {
      return false;
    }

    // Extract country code and subscriber number
    const digits = value.slice(1); // Remove '+'

    // Check allowed country codes if specified
    if (allowedCountryCodes && allowedCountryCodes.length > 0) {
      const matchedCode = allowedCountryCodes.find((code) =>
        digits.startsWith(code),
      );

      if (!matchedCode) {
        return false;
      }

      // Validate subscriber length
      const subscriberNumber = digits.slice(matchedCode.length);
      if (
        subscriberNumber.length < minSubscriberLength ||
        subscriberNumber.length > maxSubscriberLength
      ) {
        return false;
      }
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const options: E164PhoneOptions = args.constraints[0] || {};
    const { allowedCountryCodes } = options;

    if (allowedCountryCodes && allowedCountryCodes.length > 0) {
      const codes = allowedCountryCodes.map((c) => `+${c}`).join(", ");
      return `Phone number must be in E.164 format with country code: ${codes}`;
    }

    return "Phone number must be in E.164 format (e.g., +84912345678)";
  }
}

/**
 * E.164 Phone Number Decorator
 *
 * Validates that a string is a valid E.164 phone number.
 *
 * @example
 * // Allow any E.164 phone number
 * @IsE164Phone()
 * phoneNumber: string;
 *
 * @example
 * // Only allow Vietnamese phone numbers
 * @IsE164Phone({ allowedCountryCodes: ["84"] })
 * phoneNumber: string;
 *
 * @example
 * // Allow Vietnam and USA with custom subscriber length
 * @IsE164Phone({
 *   allowedCountryCodes: ["84", "1"],
 *   minSubscriberLength: 9,
 *   maxSubscriberLength: 10
 * })
 * phoneNumber: string;
 */
export function IsE164Phone(
  options?: E164PhoneOptions,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: "isE164Phone",
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: [options || {}],
      validator: IsE164PhoneConstraint,
    });
  };
}

/**
 * Vietnamese E.164 Phone Number Decorator
 *
 * Convenience decorator for Vietnamese phone numbers (+84xxxxxxxxx).
 *
 * @example
 * @IsVietnamesePhone()
 * phoneNumber: string;
 */
export function IsVietnamesePhone(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return IsE164Phone(
    {
      allowedCountryCodes: ["84"],
      minSubscriberLength: 9,
      maxSubscriberLength: 10,
    },
    {
      message:
        validationOptions?.message ||
        "Phone number must be in Vietnamese E.164 format (e.g., +84912345678)",
      ...validationOptions,
    },
  );
}
