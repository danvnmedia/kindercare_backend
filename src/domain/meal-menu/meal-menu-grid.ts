export const DEFAULT_MEAL_MENU_OPERATING_DAYS = [1, 2, 3, 4, 5] as const;
export const DEFAULT_MEAL_MENU_SLOTS = [
  "Breakfast",
  "Lunch",
  "Afternoon",
] as const;

export type MealMenuDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface MealMenuEntryInput {
  dayOfWeek: number;
  slot: string;
  description: string;
}

export interface MealMenuEntry {
  dayOfWeek: MealMenuDayOfWeek;
  slot: string;
  description: string;
}

export function toUtcDateOnly(value: Date, fieldName = "date"): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function normalizeWeekStartDate(value: Date): Date {
  const dateOnly = toUtcDateOnly(value, "weekStartDate");

  if (dateOnly.getUTCDay() !== 1) {
    throw new Error("weekStartDate must be a Monday");
  }

  return dateOnly;
}

export function normalizeDays(
  days: readonly number[],
  fieldName = "days",
): MealMenuDayOfWeek[] {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array`);
  }

  const seen = new Set<number>();
  return days.map((day) => {
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      throw new Error(
        `${fieldName} must contain unique integers from 1 through 7`,
      );
    }
    if (seen.has(day)) {
      throw new Error(`${fieldName} must not contain duplicate days`);
    }
    seen.add(day);
    return day as MealMenuDayOfWeek;
  });
}

export function normalizeMealSlots(
  mealSlots: readonly string[],
  fieldName = "mealSlots",
): string[] {
  if (!Array.isArray(mealSlots) || mealSlots.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array`);
  }

  const seen = new Set<string>();
  return mealSlots.map((slot) => {
    const normalized = slot?.trim();
    if (!normalized) {
      throw new Error(`${fieldName} must contain non-empty labels`);
    }
    if (seen.has(normalized)) {
      throw new Error(`${fieldName} must not contain duplicate labels`);
    }
    seen.add(normalized);
    return normalized;
  });
}

export function normalizeMealMenuEntries(
  entries: readonly MealMenuEntryInput[],
  days: readonly MealMenuDayOfWeek[],
  mealSlots: readonly string[],
): MealMenuEntry[] {
  if (!Array.isArray(entries)) {
    throw new Error("entries must be an array");
  }

  const allowedDays = new Set<number>(days);
  const allowedSlots = new Set<string>(mealSlots);
  const seenCells = new Set<string>();
  const normalizedEntries: MealMenuEntry[] = [];

  for (const entry of entries) {
    if (!Number.isInteger(entry.dayOfWeek)) {
      throw new Error("Entry dayOfWeek must be an integer");
    }

    const slot = entry.slot?.trim();
    if (!slot) {
      throw new Error("Entry slot is required");
    }

    if (!allowedDays.has(entry.dayOfWeek)) {
      throw new Error("Entry dayOfWeek must exist in menu days");
    }

    if (!allowedSlots.has(slot)) {
      throw new Error("Entry slot must exist in menu mealSlots");
    }

    const description = entry.description?.trim() ?? "";
    if (!description) {
      continue;
    }

    const cellKey = `${entry.dayOfWeek}:${slot}`;
    if (seenCells.has(cellKey)) {
      throw new Error("Duplicate meal-menu entry cell");
    }
    seenCells.add(cellKey);

    normalizedEntries.push({
      dayOfWeek: entry.dayOfWeek as MealMenuDayOfWeek,
      slot,
      description,
    });
  }

  return normalizedEntries;
}

export function normalizeOptionalTitle(
  title: string | null | undefined,
): string | null {
  if (title === undefined || title === null) return null;
  return title.trim() || null;
}

export function cloneMealMenuEntries(
  entries: readonly MealMenuEntry[],
): MealMenuEntry[] {
  return entries.map((entry) => ({ ...entry }));
}
