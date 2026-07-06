export type WeeklyPlanDayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface WeeklyPlanActivityInput {
  title: string;
  description?: string | null;
  order?: number;
}

export interface WeeklyPlanActivity {
  order: number;
  title: string;
  description: string | null;
}

export interface WeeklyPlanBlockInput {
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
  startMinute?: number;
  endMinute?: number;
  order?: number;
  activities: readonly WeeklyPlanActivityInput[];
}

export interface WeeklyPlanBlock {
  dayOfWeek: WeeklyPlanDayOfWeek;
  startMinute: number;
  endMinute: number;
  order: number;
  activities: WeeklyPlanActivity[];
}

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;
const MAX_THEME_LENGTH = 255;
const MAX_ACTIVITY_TITLE_LENGTH = 500;
const MAX_ACTIVITY_DESCRIPTION_LENGTH = 2000;

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

export function parseTimeToMinute(value: string, fieldName: string): number {
  if (typeof value !== "string" || !HH_MM_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be a valid HH:mm time`);
  }

  if (value === "24:00") return 1440;

  const [hours, minutes] = value.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

export function formatMinuteAsTime(
  value: number,
  fieldName = "minute",
): string {
  assertMinute(value, fieldName, true);

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function normalizeOptionalTheme(
  theme: string | null | undefined,
): string | null {
  if (theme === undefined || theme === null) return null;

  const normalized = theme.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_THEME_LENGTH) {
    throw new Error(`theme must not exceed ${MAX_THEME_LENGTH} characters`);
  }

  return normalized;
}

export function normalizeWeeklyPlanBlocks(
  blocks: readonly WeeklyPlanBlockInput[] | undefined,
): WeeklyPlanBlock[] {
  if (blocks === undefined) return [];
  if (!Array.isArray(blocks)) {
    throw new Error("blocks must be an array");
  }

  const normalized = blocks.map((block, index) =>
    normalizeWeeklyPlanBlock(block, index),
  );

  return sortAndValidateNoOverlaps(normalized);
}

export function cloneWeeklyPlanBlocks(
  blocks: readonly WeeklyPlanBlock[],
): WeeklyPlanBlock[] {
  return blocks.map((block) => ({
    ...block,
    activities: block.activities.map((activity) => ({ ...activity })),
  }));
}

export function blockStartTime(block: WeeklyPlanBlock): string {
  return formatMinuteAsTime(block.startMinute, "startMinute");
}

export function blockEndTime(block: WeeklyPlanBlock): string {
  return formatMinuteAsTime(block.endMinute, "endMinute");
}

function normalizeWeeklyPlanBlock(
  block: WeeklyPlanBlockInput,
  fallbackOrder: number,
): WeeklyPlanBlock {
  if (!block || typeof block !== "object") {
    throw new Error("block must be an object");
  }

  const dayOfWeek = normalizeDayOfWeek(block.dayOfWeek);
  const startMinute =
    block.startMinute !== undefined
      ? normalizeMinute(block.startMinute, "startMinute", false)
      : parseTimeToMinute(block.startTime ?? "", "startTime");
  const endMinute =
    block.endMinute !== undefined
      ? normalizeMinute(block.endMinute, "endMinute", true)
      : parseTimeToMinute(block.endTime ?? "", "endTime");

  if (startMinute >= endMinute) {
    throw new Error("startTime must be before endTime");
  }

  return {
    dayOfWeek,
    startMinute,
    endMinute,
    order: normalizeOrder(block.order, fallbackOrder),
    activities: normalizeActivities(block.activities),
  };
}

function normalizeDayOfWeek(value: number): WeeklyPlanDayOfWeek {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw new Error("dayOfWeek must be an integer from 1 through 7");
  }

  return value as WeeklyPlanDayOfWeek;
}

function normalizeMinute(
  value: number,
  fieldName: string,
  allowEndOfDay: boolean,
): number {
  assertMinute(value, fieldName, allowEndOfDay);
  return value;
}

function assertMinute(
  value: number,
  fieldName: string,
  allowEndOfDay: boolean,
): void {
  const max = allowEndOfDay ? 1440 : 1439;
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new Error(`${fieldName} must be an integer from 0 through ${max}`);
  }
}

function normalizeOrder(value: number | undefined, fallback: number): number {
  const order = value ?? fallback;
  if (!Number.isInteger(order) || order < 0) {
    throw new Error("order must be a non-negative integer");
  }
  return order;
}

function normalizeActivities(
  activities: readonly WeeklyPlanActivityInput[],
): WeeklyPlanActivity[] {
  if (!Array.isArray(activities) || activities.length === 0) {
    throw new Error("activities must be a non-empty array");
  }

  return activities.map((activity, index) => {
    const rawTitle =
      activity &&
      typeof activity === "object" &&
      typeof activity.title === "string"
        ? activity.title
        : "";
    const title = rawTitle.trim();

    if (!title) {
      throw new Error("Activity title is required");
    }
    if (title.length > MAX_ACTIVITY_TITLE_LENGTH) {
      throw new Error(
        `Activity title must not exceed ${MAX_ACTIVITY_TITLE_LENGTH} characters`,
      );
    }

    const description = normalizeActivityDescription(activity.description);

    return {
      order: normalizeOrder(activity.order, index),
      title,
      description,
    };
  });
}

function normalizeActivityDescription(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Activity description must be a string when provided");
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_ACTIVITY_DESCRIPTION_LENGTH) {
    throw new Error(
      `Activity description must not exceed ${MAX_ACTIVITY_DESCRIPTION_LENGTH} characters`,
    );
  }

  return normalized;
}

function sortAndValidateNoOverlaps(
  blocks: WeeklyPlanBlock[],
): WeeklyPlanBlock[] {
  const sorted = [...blocks].sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return left.dayOfWeek - right.dayOfWeek;
    }
    if (left.startMinute !== right.startMinute) {
      return left.startMinute - right.startMinute;
    }
    return left.order - right.order;
  });

  let previous: WeeklyPlanBlock | undefined;
  for (const block of sorted) {
    if (
      previous &&
      previous.dayOfWeek === block.dayOfWeek &&
      previous.endMinute > block.startMinute
    ) {
      throw new Error("Blocks must not overlap within the same day");
    }
    previous = block;
  }

  return sorted;
}
