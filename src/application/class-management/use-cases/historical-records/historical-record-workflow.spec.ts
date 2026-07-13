import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";

import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { resolveHistoricalRecord } from "./historical-record-workflow";

describe("historical record workflow cancellation retention", () => {
  it("treats cancellation as finalization and preserves legal hold and snapshots", async () => {
    const cancelledAt = new Date("2026-07-11T12:00:00.000Z");
    const enrollment = Enrollment.create(
      {
        classId: "class-1",
        studentId: "student-1",
        schoolYearEnrollmentId: "sye-1",
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
        snapshotStudentFullName: "Snapshot Student",
        snapshotClassName: "Snapshot Class",
        legalHold: true,
      },
      "enrollment-1",
    ).cancel({
      cancelledAt,
      reason: EnrollmentCancellationReason.DATA_ENTRY_ERROR,
      note: "Duplicate",
      actorId: "actor-1",
      actorFullName: "Alice Admin",
    });
    const repository = {
      findCorrections: jest.fn().mockResolvedValue([]),
      findEnrollmentByIdInCampus: jest.fn().mockResolvedValue(enrollment),
    } as unknown as HistoricalRecordRepository;

    const resolved = await resolveHistoricalRecord(
      repository,
      "ENROLLMENT",
      enrollment.id,
      "campus-1",
    );

    expect(resolved.finalized).toBe(true);
    expect(resolved.view).toMatchObject({
      cancelledAt,
      cancellationReason: EnrollmentCancellationReason.DATA_ENTRY_ERROR,
      snapshot: {
        student: { fullName: "Snapshot Student" },
        class: { name: "Snapshot Class" },
      },
      retentionState: {
        legalHold: true,
        deletionEligible: false,
      },
    });
  });
});
