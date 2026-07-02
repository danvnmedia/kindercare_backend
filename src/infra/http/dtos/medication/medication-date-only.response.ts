import { formatMedicationDateOnly } from "@/domain/medication";

export function formatMedicationResponseDateOnly(
  value: unknown,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
  }

  return formatMedicationDateOnly(value as Date | string | null);
}
