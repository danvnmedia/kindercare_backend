import {
  buildHistoricalEnrollmentView,
  buildHistoricalSchoolYearEnrollmentView,
} from "./historical-record-view";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Class } from "@/domain/class-management/entities/class.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { Student } from "@/domain/user-management/entities/student.entity";

const campusId = "campus-1";
const studentId = "student-1";

function student(name = "Current Student"): Student {
  return Student.create(
    {
      campusId,
      studentCode: "CUR-001",
      fullName: name,
      nickname: "Cur",
      email: null,
      phoneNumber: null,
      address: null,
      dateOfBirth: null,
      gender: null,
    },
    studentId,
  );
}

function classWithRelations(): Class {
  const schoolYear = SchoolYear.create(
    {
      campusId,
      name: "Current SY",
      startDate: new Date("2024-09-01T00:00:00.000Z"),
      endDate: new Date("2025-06-30T00:00:00.000Z"),
    },
    "sy-1",
  );
  const gradeLevel = GradeLevel.create(
    {
      campusId,
      name: "Current Grade",
      order: 2,
    },
    "grade-1",
  );

  return Class.create(
    {
      campusId,
      name: "Current Class",
      schoolYearId: schoolYear.id,
      gradeLevelId: gradeLevel.id,
      schoolYear,
      gradeLevel,
      description: null,
    },
    "class-1",
  );
}

describe("historical record views", () => {
  it("prefers stored enrollment snapshots and applies correction events to the effective view", () => {
    const enrollment = Enrollment.create(
      {
        classId: "class-1",
        studentId,
        schoolYearEnrollmentId: "sye-1",
        enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
        endDate: new Date("2025-01-31T00:00:00.000Z"),
        exitReason: ExitReason.TRANSFERRED,
        note: null,
        snapshotStudentFullName: "Snapshot Student",
        snapshotStudentCode: "SNAP-001",
        snapshotStudentNickname: "Snap",
        snapshotClassName: "Snapshot Class",
        snapshotGradeLevelName: "Snapshot Grade",
        snapshotGradeLevelOrder: 1,
        snapshotSchoolYearName: "Snapshot SY",
        snapshotSchoolYearStartDate: new Date("2024-08-15T00:00:00.000Z"),
        snapshotSchoolYearEndDate: new Date("2025-06-15T00:00:00.000Z"),
      },
      "enrollment-1",
    );

    const view = buildHistoricalEnrollmentView(enrollment, [
      {
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        afterValue: {
          studentFullName: "Corrected Student",
          className: "Corrected Class",
          schoolYearStartDate: "2024-09-02",
        },
      },
    ]);

    expect(view.id).toBe("enrollment-1");
    expect(view.classId).toBe("class-1");
    expect(view.studentId).toBe(studentId);
    expect(view.snapshot.student.fullName).toBe("Snapshot Student");
    expect(view.snapshot.class?.name).toBe("Snapshot Class");
    expect(view.effectiveSnapshot.student.fullName).toBe("Corrected Student");
    expect(view.effectiveSnapshot.class?.name).toBe("Corrected Class");
    expect(view.effectiveSnapshot.schoolYear.startDate).toEqual(
      new Date("2024-09-02"),
    );
    expect(view.snapshotAvailability).toEqual({
      student: "SNAPSHOT",
      class: "SNAPSHOT",
      gradeLevel: "SNAPSHOT",
      schoolYear: "SNAPSHOT",
    });
    expect(view.correctionSummary).toEqual({
      appliedCount: 1,
      lastCorrectedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect("attendance" in view).toBe(false);
  });

  it("marks legacy enrollment values as current-data fallback instead of silent substitution", () => {
    const enrollment = Enrollment.create(
      {
        classId: "class-1",
        studentId,
        schoolYearEnrollmentId: "sye-1",
        enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
        note: null,
        class: classWithRelations(),
        student: student(),
      },
      "legacy-enrollment",
    );

    const view = buildHistoricalEnrollmentView(enrollment);

    expect(view.snapshot.student.fullName).toBe("Current Student");
    expect(view.snapshot.class?.name).toBe("Current Class");
    expect(view.snapshot.gradeLevel.name).toBe("Current Grade");
    expect(view.snapshot.schoolYear.name).toBe("Current SY");
    expect(view.snapshotAvailability).toEqual({
      student: "CURRENT_FALLBACK",
      class: "CURRENT_FALLBACK",
      gradeLevel: "CURRENT_FALLBACK",
      schoolYear: "CURRENT_FALLBACK",
    });
  });

  it("keeps school-year history class snapshots unavailable and preserves child count", () => {
    const schoolYear = classWithRelations().schoolYear!;
    const gradeLevel = classWithRelations().gradeLevel!;
    const schoolYearEnrollment = SchoolYearEnrollment.create(
      {
        studentId,
        campusId,
        schoolYearId: schoolYear.id,
        gradeLevelId: gradeLevel.id,
        enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
        schoolYear,
        gradeLevel,
        student: student("School Year Student"),
      },
      "sye-1",
    );

    const view = buildHistoricalSchoolYearEnrollmentView(
      schoolYearEnrollment,
      3,
    );

    expect(view.childEnrollmentCount).toBe(3);
    expect(view.snapshot.class).toBeNull();
    expect(view.snapshotAvailability.class).toBe("MISSING");
    expect(view.snapshotAvailability.student).toBe("CURRENT_FALLBACK");
    expect("attendance" in view).toBe(false);
  });

  it("projects cancelled child history with a stable actor summary", () => {
    const referenceDate = new Date("2026-07-11T12:00:00.000Z");
    const cancelled = Enrollment.create(
      {
        classId: "class-1",
        studentId,
        schoolYearEnrollmentId: "sye-1",
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      },
      "cancelled-child",
    ).cancel({
      cancelledAt: referenceDate,
      reason: EnrollmentCancellationReason.DATA_ENTRY_ERROR,
      note: "duplicate import",
      actorId: "actor-1",
      actorFullName: "Alice Admin",
    });

    const view = buildHistoricalEnrollmentView(cancelled, [], referenceDate);

    expect(view).toMatchObject({
      effectiveStatus: "CANCELLED",
      cancellationReason: EnrollmentCancellationReason.DATA_ENTRY_ERROR,
      cancellationNote: "duplicate import",
      cancelledBy: { id: "actor-1", fullName: "Alice Admin" },
    });
  });
});
