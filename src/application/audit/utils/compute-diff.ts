/**
 * Generic before/after diff for audit `before_value` / `after_value` payloads.
 *
 * Returns only the keys whose values differ. Used by `EDIT_*` audit actions to
 * satisfy Scenario 3 of `@doc/specs/admin-audit-log` — a `PATCH` that only
 * touches one field MUST NOT record any other field in the diff, even when
 * the use case had the full entity in memory.
 *
 * Equality semantics:
 *   - Primitives (`string | number | boolean | null | undefined`): `Object.is`.
 *     This treats `NaN === NaN` and distinguishes `+0` from `-0`, which both
 *     match domain expectations for the audit payload.
 *   - `Date` instances: compared by `.getTime()`. Two `Date` objects with the
 *     same instant are treated as equal even though `===` would return false.
 *   - Anything else (plain objects / arrays): falls back to a stable JSON
 *     comparison. Profile-edit payloads in this codebase never carry nested
 *     structures, but the fallback keeps the helper safe if it is reused.
 *
 * A key that is present on `before` but missing from `after` is treated as
 * "unchanged" — the caller did not supply a new value, so nothing changed
 * from the recorder's perspective. To represent a clear-to-null transition,
 * the caller must include the key in `after` with an explicit `null`.
 */

export interface ComputeDiffResult<T> {
  before: Partial<T>;
  after: Partial<T>;
}

export function computeDiff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): ComputeDiffResult<T> {
  const diffBefore: Partial<T> = {};
  const diffAfter: Partial<T> = {};

  for (const key of Object.keys(after) as Array<keyof T>) {
    const beforeValue = before[key];
    const afterValue = after[key] as T[keyof T];

    if (!areEqual(beforeValue, afterValue)) {
      diffBefore[key] = beforeValue;
      diffAfter[key] = afterValue;
    }
  }

  return { before: diffBefore, after: diffAfter };
}

function areEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  const aIsObject = typeof a === "object" && a !== null;
  const bIsObject = typeof b === "object" && b !== null;
  if (aIsObject && bIsObject) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}
