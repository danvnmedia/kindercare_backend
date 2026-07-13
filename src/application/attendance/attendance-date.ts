import { BadRequestException } from "@nestjs/common";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseAttendanceDateOnly(
  value: string | Date,
  fieldName = "date",
): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new BadRequestException(`${fieldName} must be in YYYY-MM-DD format`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${fieldName} must be a valid date`);
  }

  return date;
}

export function formatAttendanceDateOnly(value: Date): string {
  return parseAttendanceDateOnly(value).toISOString().slice(0, 10);
}
