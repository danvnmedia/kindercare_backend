const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_GAP_MINUTES = 24 * 60;

interface WallTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function assertValidIanaTimeZone(timeZone: string): void {
  try {
    getFormatter(timeZone).format(new Date(0));
  } catch {
    throw new Error("Campus timeZone must be a valid IANA timezone");
  }
}

export function getCampusDateString(instant: Date, timeZone: string): string {
  const parts = getWallTimeParts(instant, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function getCampusDateOnly(instant: Date, timeZone: string): Date {
  return parseDateOnly(getCampusDateString(instant, timeZone));
}

export function campusWallTimeToInstant(
  dateOnly: Date | string,
  minuteOfDay: number,
  timeZone: string,
): Date {
  assertValidIanaTimeZone(timeZone);
  assertMinuteOfDay(minuteOfDay);

  const date = normalizeDateParts(dateOnly);
  const requestedWallTime = addWallMinutes(date, minuteOfDay);

  for (let shift = 0; shift <= MAX_GAP_MINUTES; shift += 1) {
    const wallTime = addWallMinutes(requestedWallTime, shift);
    const candidates = findMatchingInstants(wallTime, timeZone);

    if (candidates.length > 0) {
      return new Date(Math.min(...candidates));
    }
  }

  throw new Error(`Unable to resolve campus wall time in timezone ${timeZone}`);
}

export function getCampusStartOfNextDay(
  dateOnly: Date | string,
  timeZone: string,
): Date {
  const date = normalizeDateParts(dateOnly);
  const nextDay = addWallMinutes(date, 24 * 60);
  return campusWallTimeToInstant(toDateOnlyString(nextDay), 0, timeZone);
}

export function getCampusMinuteOfDay(instant: Date, timeZone: string): number {
  const parts = getWallTimeParts(instant, timeZone);
  return parts.hour * 60 + parts.minute;
}

function findMatchingInstants(
  wallTime: WallTimeParts,
  timeZone: string,
): number[] {
  const naiveUtc = Date.UTC(
    wallTime.year,
    wallTime.month - 1,
    wallTime.day,
    wallTime.hour,
    wallTime.minute,
    wallTime.second,
  );
  const sampleOffsets = new Set<number>();

  for (const deltaHours of [-48, -24, -12, 0, 12, 24, 48]) {
    sampleOffsets.add(
      getOffsetMilliseconds(
        new Date(naiveUtc + deltaHours * 3_600_000),
        timeZone,
      ),
    );
  }

  const candidates: number[] = [];
  for (const offset of sampleOffsets) {
    const candidate = naiveUtc - offset;
    if (
      sameWallTime(getWallTimeParts(new Date(candidate), timeZone), wallTime)
    ) {
      candidates.push(candidate);
    }
  }

  return [...new Set(candidates)];
}

function getOffsetMilliseconds(instant: Date, timeZone: string): number {
  const parts = getWallTimeParts(instant, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const instantAtWholeSecond = Math.floor(instant.getTime() / 1000) * 1000;
  return representedAsUtc - instantAtWholeSecond;
}

function getWallTimeParts(instant: Date, timeZone: string): WallTimeParts {
  const values = new Map(
    getFormatter(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function normalizeDateParts(value: Date | string): WallTimeParts {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("Date must be a valid date-only value");
    }

    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    };
  }

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error("Date must use YYYY-MM-DD format");
  }

  const parsed = parseDateOnly(value);
  if (getCampusDateString(parsed, "UTC") !== value) {
    throw new Error("Date must be a real calendar date");
  }

  return normalizeDateParts(parsed);
}

function parseDateOnly(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new Error("Date must use YYYY-MM-DD format");
  }

  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

function addWallMinutes(
  value: Pick<WallTimeParts, "year" | "month" | "day"> &
    Partial<Pick<WallTimeParts, "hour" | "minute" | "second">>,
  minutes: number,
): WallTimeParts {
  const instant = new Date(
    Date.UTC(
      value.year,
      value.month - 1,
      value.day,
      value.hour ?? 0,
      value.minute ?? 0,
      value.second ?? 0,
    ) +
      minutes * 60_000,
  );

  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
    hour: instant.getUTCHours(),
    minute: instant.getUTCMinutes(),
    second: instant.getUTCSeconds(),
  };
}

function sameWallTime(left: WallTimeParts, right: WallTimeParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function toDateOnlyString(parts: WallTimeParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function assertMinuteOfDay(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= 24 * 60) {
    throw new Error("Minute of day must be between 0 and 1439");
  }
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
