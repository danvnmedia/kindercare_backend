import {
  MedicationAdministrationOccurrence,
  MedicationRequest,
} from "@/domain/medication";

import {
  getMedicationOccurrenceDueAt,
  getMedicationRequestCompletionBoundary,
  getMedicationRequestExpirationBoundary,
} from "./medication-time-boundaries";

const REQUEST_ID = "11111111-1111-4111-a111-111111111111";
const ITEM_ID = "22222222-2222-4222-a222-222222222222";
const CAMPUS_ID = "33333333-3333-4333-a333-333333333333";
const STUDENT_ID = "44444444-4444-4444-a444-444444444444";

function createOccurrence(
  dueDate: string,
  dueMinute: number,
): MedicationAdministrationOccurrence {
  return MedicationAdministrationOccurrence.create({
    requestId: REQUEST_ID,
    medicationItemId: ITEM_ID,
    campusId: CAMPUS_ID,
    studentId: STUDENT_ID,
    dueDate,
    dueMinute,
  });
}

function createRequest(
  occurrences: MedicationAdministrationOccurrence[],
): MedicationRequest {
  return MedicationRequest.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      requesterGuardianId: "55555555-5555-4555-a555-555555555555",
      startDate: "2026-10-31",
      endDate: "2026-11-01",
      items: [
        {
          id: ITEM_ID,
          medicationName: "Antibiotic syrup",
          instructions: "Give with water.",
          timesOfDay: ["01:30"],
        },
      ],
      occurrences,
    },
    REQUEST_ID,
  );
}

describe("medication time boundaries", () => {
  it("expires at the start of the campus-local day after endDate", () => {
    const request = createRequest([]);

    expect(
      getMedicationRequestExpirationBoundary(
        request,
        "America/Toronto",
      ).toISOString(),
    ).toBe("2026-11-02T05:00:00.000Z");
  });

  it("completes at the latest materialized campus-local occurrence", () => {
    const request = createRequest([
      createOccurrence("2026-10-31", 23 * 60),
      createOccurrence("2026-11-01", 90),
    ]);

    expect(
      getMedicationRequestCompletionBoundary(
        request,
        "America/Toronto",
      ).toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("uses the day-after-endDate fallback when occurrences are absent", () => {
    const request = createRequest([]);

    expect(
      getMedicationRequestCompletionBoundary(
        request,
        "America/Toronto",
      ).toISOString(),
    ).toBe("2026-11-02T05:00:00.000Z");
  });

  it("applies the shared DST gap policy to occurrence instants", () => {
    const occurrence = createOccurrence("2026-03-08", 2 * 60 + 30);

    expect(
      getMedicationOccurrenceDueAt(occurrence, "America/Toronto").toISOString(),
    ).toBe("2026-03-08T07:00:00.000Z");
  });
});
