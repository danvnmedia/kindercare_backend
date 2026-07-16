import {
  StudentHealthCheckup,
  StudentHealthCheckupType,
  StudentHealthConditionCategory,
  StudentHealthEvent,
  StudentHealthEventStatus,
  StudentHealthEventType,
  StudentHealthInstruction,
  StudentHealthInstructionType,
} from "@/domain/student-health";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const STUDENT_ID = "22222222-2222-4222-a222-222222222222";
const FIRST_ACTOR_ID = "33333333-3333-4333-a333-333333333333";
const SECOND_ACTOR_ID = "44444444-4444-4444-a444-444444444444";
const FIRST_ARCHIVED_AT = new Date("2026-07-01T10:00:00.000Z");
const SECOND_ARCHIVED_AT = new Date("2026-07-02T10:00:00.000Z");

interface ArchivableHealthRecord {
  readonly archivedAt: Date | null;
  readonly archivedByUserId: string | null;
  readonly isArchived: boolean;
  archive(actorUserId: string, archivedAt?: Date): boolean;
}

const healthRecordFactories: Array<{
  name: string;
  create: () => ArchivableHealthRecord;
}> = [
  {
    name: "checkup",
    create: () =>
      StudentHealthCheckup.create({
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        checkupType: StudentHealthCheckupType.GENERAL,
        checkedAt: new Date("2020-01-15T09:00:00.000Z"),
        notes: "Routine checkup.",
      }),
  },
  {
    name: "instruction",
    create: () =>
      StudentHealthInstruction.create({
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        instructionType: StudentHealthInstructionType.CARE,
        title: "Monitor hydration",
        instruction: "Offer water regularly.",
        startDate: "2026-07-01",
      }),
  },
  {
    name: "event",
    create: () =>
      StudentHealthEvent.create({
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        eventType: StudentHealthEventType.OBSERVATION,
        category: StudentHealthConditionCategory.OTHER,
        title: "Hydration observation",
        occurredAt: new Date("2020-01-15T09:00:00.000Z"),
        status: StudentHealthEventStatus.RESOLVED,
      }),
  },
];

describe.each(healthRecordFactories)("$name archive state", ({ create }) => {
  it("sets archive actor and timestamp once", () => {
    const record = create();

    expect(record.isArchived).toBe(false);
    expect(record.archive(FIRST_ACTOR_ID, FIRST_ARCHIVED_AT)).toBe(true);
    expect(record).toMatchObject({
      archivedAt: FIRST_ARCHIVED_AT,
      archivedByUserId: FIRST_ACTOR_ID,
      isArchived: true,
    });

    expect(record.archive(SECOND_ACTOR_ID, SECOND_ARCHIVED_AT)).toBe(false);
    expect(record.archivedAt).toBe(FIRST_ARCHIVED_AT);
    expect(record.archivedByUserId).toBe(FIRST_ACTOR_ID);
  });
});

describe("student health archive metadata", () => {
  it("hydrates legacy archive metadata without requiring an actor", () => {
    const event = StudentHealthEvent.create({
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      eventType: StudentHealthEventType.ILLNESS,
      title: "Legacy event",
      occurredAt: new Date("2020-01-15T09:00:00.000Z"),
      status: StudentHealthEventStatus.RESOLVED,
      archivedAt: FIRST_ARCHIVED_AT,
      archivedByUserId: null,
    });

    expect(event.isArchived).toBe(true);
    expect(event.archivedAt).toBe(FIRST_ARCHIVED_AT);
    expect(event.archivedByUserId).toBeNull();
  });

  it("rejects archive actors without an archive timestamp", () => {
    expect(() =>
      StudentHealthEvent.create({
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        eventType: StudentHealthEventType.ILLNESS,
        title: "Invalid archive state",
        occurredAt: new Date("2020-01-15T09:00:00.000Z"),
        status: StudentHealthEventStatus.RESOLVED,
        archivedByUserId: FIRST_ACTOR_ID,
      }),
    ).toThrow("Archived-by user ID requires an archive timestamp");
  });
});
