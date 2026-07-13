import { SchoolYearEnrollment } from "./school-year-enrollment.entity";
import { ExitReason } from "../enums/exit-reason.enum";
import { SchoolYearEnrollmentAlreadyClosedException } from "../exceptions/school-year-enrollment-already-closed.exception";
import { InvalidExitDateException } from "../exceptions/invalid-exit-date.exception";
import { EnrollmentCancellationReason } from "../enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "../enums/enrollment-effective-status.enum";

describe("SchoolYearEnrollment Entity", () => {
  const baseProps = {
    studentId: "student-1",
    campusId: "campus-1",
    schoolYearId: "sy-1",
    gradeLevelId: "grade-1",
    enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
    note: null,
  };

  describe("create", () => {
    it("creates an active enrollment with exitDate and exitReason defaulting to null", () => {
      const enrollment = SchoolYearEnrollment.create(baseProps);

      expect(enrollment.studentId).toBe("student-1");
      expect(enrollment.campusId).toBe("campus-1");
      expect(enrollment.schoolYearId).toBe("sy-1");
      expect(enrollment.gradeLevelId).toBe("grade-1");
      expect(enrollment.enrollmentDate).toEqual(
        new Date("2026-01-15T00:00:00.000Z"),
      );
      expect(enrollment.exitDate).toBeNull();
      expect(enrollment.exitReason).toBeNull();
      expect(enrollment.note).toBeNull();
      expect(enrollment.id).toBeDefined();
      expect(enrollment.createdAt).toBeInstanceOf(Date);
      expect(enrollment.updatedAt).toBeInstanceOf(Date);
    });

    it("accepts both exitDate and exitReason set together", () => {
      const enrollment = SchoolYearEnrollment.create({
        ...baseProps,
        exitDate: new Date("2026-03-01T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
      });

      expect(enrollment.exitDate).toEqual(new Date("2026-03-01T00:00:00.000Z"));
      expect(enrollment.exitReason).toBe(ExitReason.WITHDRAWN);
      expect(enrollment.isActive()).toBe(false);
    });

    it("trims note and stores empty as null", () => {
      const withNote = SchoolYearEnrollment.create({
        ...baseProps,
        note: "  hello  ",
      });
      expect(withNote.note).toBe("hello");

      const blankNote = SchoolYearEnrollment.create({
        ...baseProps,
        note: "   ",
      });
      expect(blankNote.note).toBeNull();
    });

    it("throws when studentId is empty", () => {
      expect(() =>
        SchoolYearEnrollment.create({ ...baseProps, studentId: "" }),
      ).toThrow("Student ID is required");
    });

    it("throws when campusId is empty", () => {
      expect(() =>
        SchoolYearEnrollment.create({ ...baseProps, campusId: "" }),
      ).toThrow("Campus ID is required");
    });

    it("throws when schoolYearId is empty", () => {
      expect(() =>
        SchoolYearEnrollment.create({ ...baseProps, schoolYearId: "" }),
      ).toThrow("School year ID is required");
    });

    it("throws when gradeLevelId is empty", () => {
      expect(() =>
        SchoolYearEnrollment.create({ ...baseProps, gradeLevelId: "" }),
      ).toThrow("Grade level ID is required");
    });

    it("throws when enrollmentDate is missing", () => {
      expect(() =>
        SchoolYearEnrollment.create({
          ...baseProps,
          enrollmentDate: undefined as unknown as Date,
        }),
      ).toThrow("Enrollment date is required");
    });

    it("throws when exitDate is set but exitReason is null (XOR invariant)", () => {
      expect(() =>
        SchoolYearEnrollment.create({
          ...baseProps,
          exitDate: new Date("2026-03-01T00:00:00.000Z"),
          exitReason: null,
        }),
      ).toThrow(
        "SchoolYearEnrollment exitDate and exitReason must both be set or both be null",
      );
    });

    it("throws when exitReason is set but exitDate is null (XOR invariant)", () => {
      expect(() =>
        SchoolYearEnrollment.create({
          ...baseProps,
          exitDate: null,
          exitReason: ExitReason.WITHDRAWN,
        }),
      ).toThrow(
        "SchoolYearEnrollment exitDate and exitReason must both be set or both be null",
      );
    });

    it("rejects TRANSFERRED as a parent exit reason", () => {
      expect(() =>
        SchoolYearEnrollment.create({
          ...baseProps,
          exitDate: new Date("2026-03-01T00:00:00.000Z"),
          exitReason: ExitReason.TRANSFERRED,
        }),
      ).toThrow(
        "TRANSFERRED is not a valid exit reason for SchoolYearEnrollment",
      );
    });
  });

  describe("isActive", () => {
    it("returns true when exitDate is null", () => {
      const enrollment = SchoolYearEnrollment.create(baseProps);
      expect(enrollment.isActive()).toBe(true);
    });

    it("returns false when exitDate is set", () => {
      const enrollment = SchoolYearEnrollment.create({
        ...baseProps,
        exitDate: new Date("2026-03-01T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
      });
      expect(enrollment.isActive()).toBe(false);
    });
  });

  describe("withdraw", () => {
    let enrollment: SchoolYearEnrollment;

    beforeEach(() => {
      enrollment = SchoolYearEnrollment.create(baseProps, "sye-1");
    });

    it("returns a new entity with exitDate and exitReason set", () => {
      const exitDate = new Date("2026-03-01T00:00:00.000Z");
      const closed = enrollment.withdraw(exitDate, ExitReason.WITHDRAWN);

      expect(closed.exitDate).toEqual(exitDate);
      expect(closed.exitReason).toBe(ExitReason.WITHDRAWN);
      expect(closed.isActive()).toBe(false);
    });

    it("preserves the same entity id (immutable transition)", () => {
      const closed = enrollment.withdraw(
        new Date("2026-03-01T00:00:00.000Z"),
        ExitReason.WITHDRAWN,
      );
      expect(closed.id).toBe("sye-1");
    });

    it("does not mutate the original entity", () => {
      enrollment.withdraw(
        new Date("2026-03-01T00:00:00.000Z"),
        ExitReason.WITHDRAWN,
      );
      expect(enrollment.exitDate).toBeNull();
      expect(enrollment.exitReason).toBeNull();
      expect(enrollment.isActive()).toBe(true);
    });

    it("preserves studentId, campusId, schoolYearId, gradeLevelId, note, and createdAt", () => {
      const closed = enrollment.withdraw(
        new Date("2026-03-01T00:00:00.000Z"),
        ExitReason.GRADUATED,
      );
      expect(closed.studentId).toBe(enrollment.studentId);
      expect(closed.campusId).toBe(enrollment.campusId);
      expect(closed.schoolYearId).toBe(enrollment.schoolYearId);
      expect(closed.gradeLevelId).toBe(enrollment.gradeLevelId);
      expect(closed.note).toBe(enrollment.note);
      expect(closed.createdAt).toEqual(enrollment.createdAt);
    });

    it("throws SchoolYearEnrollmentAlreadyClosedException when called on a closed enrollment", () => {
      const closed = enrollment.withdraw(
        new Date("2026-03-01T00:00:00.000Z"),
        ExitReason.WITHDRAWN,
      );

      expect(() =>
        closed.withdraw(
          new Date("2026-03-15T00:00:00.000Z"),
          ExitReason.WITHDRAWN,
        ),
      ).toThrow(SchoolYearEnrollmentAlreadyClosedException);
    });

    it("throws InvalidExitDateException when exitDate is before enrollmentDate", () => {
      expect(() =>
        enrollment.withdraw(
          new Date("2026-01-10T00:00:00.000Z"),
          ExitReason.WITHDRAWN,
        ),
      ).toThrow(InvalidExitDateException);
    });

    it("throws InvalidExitDateException when exitDate is in the future", () => {
      const future = new Date();
      future.setUTCDate(future.getUTCDate() + 5);

      expect(() => enrollment.withdraw(future, ExitReason.WITHDRAWN)).toThrow(
        InvalidExitDateException,
      );
    });

    it("accepts exitDate equal to today (boundary)", () => {
      const today = new Date();
      const pastEnrollment = SchoolYearEnrollment.create({
        ...baseProps,
        enrollmentDate: new Date("2026-01-01T00:00:00.000Z"),
      });

      expect(() =>
        pastEnrollment.withdraw(today, ExitReason.WITHDRAWN),
      ).not.toThrow();
    });

    it("accepts exitDate equal to enrollmentDate (boundary)", () => {
      expect(() =>
        enrollment.withdraw(baseProps.enrollmentDate, ExitReason.COMPLETED),
      ).not.toThrow();
    });

    it("rejects TRANSFERRED at withdraw() before any date validation", () => {
      expect(() =>
        enrollment.withdraw(
          new Date("2026-03-01T00:00:00.000Z"),
          ExitReason.TRANSFERRED,
        ),
      ).toThrow(
        "TRANSFERRED is not a valid exit reason for SchoolYearEnrollment",
      );
    });
  });

  describe("effective status and cancellation", () => {
    const futureProps = {
      ...baseProps,
      enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    };
    const cancelledAt = new Date("2026-07-11T15:30:00.000Z");

    it("derives upcoming, active, and inclusive closed boundaries", () => {
      const enrollment = SchoolYearEnrollment.create({
        ...futureProps,
        exitDate: new Date("2026-09-30T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
      });

      expect(
        enrollment.getEffectiveStatus(new Date("2026-08-31T23:59:59.999Z")),
      ).toBe(EnrollmentEffectiveStatus.UPCOMING);
      expect(
        enrollment.getEffectiveStatus(new Date("2026-09-30T23:59:59.999Z")),
      ).toBe(EnrollmentEffectiveStatus.ACTIVE);
      expect(
        enrollment.getEffectiveStatus(new Date("2026-10-01T00:00:00.000Z")),
      ).toBe(EnrollmentEffectiveStatus.CLOSED);
    });

    it("cancels an upcoming row immutably without fabricating closure data", () => {
      const original = SchoolYearEnrollment.create(futureProps, "sye-future");
      const cancelled = original.cancel({
        cancelledAt,
        reason: EnrollmentCancellationReason.CHANGED_SCHOOL,
        note: "  changing schools  ",
        actorId: "user-1",
        actorFullName: "  Casey Admin  ",
      });

      expect(cancelled.id).toBe(original.id);
      expect(cancelled.getEffectiveStatus(cancelledAt)).toBe(
        EnrollmentEffectiveStatus.CANCELLED,
      );
      expect(cancelled.cancelledAt).toEqual(cancelledAt);
      expect(cancelled.cancellationReason).toBe(
        EnrollmentCancellationReason.CHANGED_SCHOOL,
      );
      expect(cancelled.cancellationNote).toBe("changing schools");
      expect(cancelled.cancelledByUserId).toBe("user-1");
      expect(cancelled.cancelledByFullName).toBe("Casey Admin");
      expect(cancelled.historicalFinalizedAt).toEqual(cancelledAt);
      expect(cancelled.exitDate).toBeNull();
      expect(cancelled.exitReason).toBeNull();
      expect(original.cancelledAt).toBeNull();
    });

    it("rejects incomplete or oversized cancellation metadata", () => {
      expect(() =>
        SchoolYearEnrollment.create({
          ...futureProps,
          cancelledAt,
          cancellationReason: EnrollmentCancellationReason.OTHER,
        }),
      ).toThrow(
        "Cancelled SchoolYearEnrollment requires cancellationReason and cancelledByUserId",
      );

      expect(() =>
        SchoolYearEnrollment.create({
          ...futureProps,
          cancelledAt,
          cancellationReason: "NOT_A_REASON" as EnrollmentCancellationReason,
          cancelledByUserId: "user-1",
        }),
      ).toThrow("SchoolYearEnrollment cancellationReason is invalid");

      expect(() =>
        SchoolYearEnrollment.create({
          ...futureProps,
          cancelledAt,
          cancellationReason: EnrollmentCancellationReason.OTHER,
          cancelledByUserId: "   ",
        }),
      ).toThrow(
        "Cancelled SchoolYearEnrollment requires cancellationReason and cancelledByUserId",
      );

      expect(() =>
        SchoolYearEnrollment.create({
          ...futureProps,
          cancelledAt,
          cancellationReason: EnrollmentCancellationReason.OTHER,
          cancellationNote: "x".repeat(501),
          cancelledByUserId: "user-1",
        }),
      ).toThrow(
        "SchoolYearEnrollment cancellationNote must be at most 500 characters",
      );
    });

    it("rejects cancelling a row once it is effective", () => {
      const active = SchoolYearEnrollment.create(baseProps);

      expect(() =>
        active.cancel({
          cancelledAt,
          reason: EnrollmentCancellationReason.DATA_ENTRY_ERROR,
          actorId: "user-1",
        }),
      ).toThrow("Only an upcoming school-year enrollment can be cancelled");
    });
  });
});
