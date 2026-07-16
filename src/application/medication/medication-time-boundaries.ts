import {
  campusWallTimeToInstant,
  getCampusStartOfNextDay,
} from "@/core/time/campus-time-zone";
import {
  MedicationAdministrationOccurrence,
  MedicationRequest,
} from "@/domain/medication";

export function getMedicationRequestExpirationBoundary(
  request: MedicationRequest,
  timeZone: string,
): Date {
  return getCampusStartOfNextDay(request.endDate, timeZone);
}

export function getMedicationRequestCompletionBoundary(
  request: MedicationRequest,
  timeZone: string,
): Date {
  if (request.occurrences.length === 0) {
    return getCampusStartOfNextDay(request.endDate, timeZone);
  }

  return request.occurrences.reduce(
    (latest, occurrence) => {
      const dueAt = getMedicationOccurrenceDueAt(occurrence, timeZone);
      return dueAt.getTime() > latest.getTime() ? dueAt : latest;
    },
    getMedicationOccurrenceDueAt(request.occurrences[0], timeZone),
  );
}

export function getMedicationOccurrenceDueAt(
  occurrence: MedicationAdministrationOccurrence,
  timeZone: string,
): Date {
  return campusWallTimeToInstant(
    occurrence.dueDate,
    occurrence.dueMinute,
    timeZone,
  );
}
