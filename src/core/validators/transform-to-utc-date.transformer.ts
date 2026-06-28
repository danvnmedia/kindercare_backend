import { Transform, TransformFnParams } from "class-transformer";
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

/**
 * ISO 8601 Date Format Regex
 *
 * Matches formats:
 * - 2020-05-15T00:00:00.000Z (full ISO with milliseconds)
 * - 2020-05-15T00:00:00Z (ISO without milliseconds)
 * - 2020-05-15 (date only - will be treated as UTC midnight)
 */
const ISO_8601_REGEX =
  /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Parse a date string and return a Date object in UTC
 *
 * Handles various input formats and normalizes them to UTC:
 * - ISO 8601 with timezone: "2020-05-15T00:00:00.000Z" → UTC midnight
 * - ISO 8601 date only: "2020-05-15" → UTC midnight
 * - Date object: passed through
 *
 * @param value - The value to parse
 * @returns Date object in UTC or null if invalid
 */
export function parseToUTCDate(value: unknown): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // String input
  if (typeof value === "string") {
    const trimmed = value.trim();

    // Check if it's a valid ISO 8601 format
    if (!ISO_8601_REGEX.test(trimmed)) {
      return null;
    }

    // For date-only strings (e.g., "2020-05-15"), append UTC midnight
    // This ensures consistent parsing regardless of server timezone
    let dateString = trimmed;
    if (!dateString.includes("T")) {
      dateString = `${trimmed}T00:00:00.000Z`;
    } else if (
      !dateString.endsWith("Z") &&
      !dateString.match(/[+-]\d{2}:\d{2}$/)
    ) {
      // Has time but no timezone indicator - treat as UTC
      dateString = `${trimmed}Z`;
    }

    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Transform decorator that converts date strings to UTC Date objects
 *
 * Use this on DTO date fields to ensure consistent UTC handling.
 * Works with class-transformer's transform pipeline.
 *
 * @example
 * class CreateStudentRequest {
 *   @TransformToUTCDate()
 *   @IsDateOfBirth()
 *   dateOfBirth?: Date;
 * }
 */
export function TransformToUTCDate(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams) => parseToUTCDate(value));
}

/**
 * Validator constraint for ISO 8601 date format
 */
@ValidatorConstraint({ name: "isISO8601Date", async: false })
export class IsISO8601DateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true; // Let @IsOptional or @IsNotEmpty handle this
    }

    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }

    if (typeof value === "string") {
      return ISO_8601_REGEX.test(value.trim());
    }

    return false;
  }

  defaultMessage(): string {
    return "Date must be in ISO 8601 format (e.g., 2020-05-15T00:00:00.000Z or 2020-05-15)";
  }
}

/**
 * Validates that a value is a valid ISO 8601 date string
 *
 * Use this in combination with @TransformToUTCDate() for complete date handling.
 *
 * @example
 * class CreateEventRequest {
 *   @TransformToUTCDate()
 *   @IsISO8601Date()
 *   eventDate: Date;
 * }
 */
export function IsISO8601Date(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: "isISO8601Date",
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message:
          "Date must be in ISO 8601 format (e.g., 2020-05-15T00:00:00.000Z or 2020-05-15)",
        ...validationOptions,
      },
      validator: IsISO8601DateConstraint,
    });
  };
}
