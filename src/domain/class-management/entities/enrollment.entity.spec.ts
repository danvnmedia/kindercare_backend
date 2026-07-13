import { Enrollment } from "./enrollment.entity";
import { ExitReason } from "../enums/exit-reason.enum";
import { EnrollmentAlreadyClosedException } from "../exceptions/enrollment-already-closed.exception";
import { InvalidEndDateException } from "../exceptions/invalid-end-date.exception";
import { EnrollmentCancellationReason } from "../enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "../enums/enrollment-effective-status.enum";

describe("Enrollment Entity", () => {
  const baseProps = {
    classId: "class-1",
    studentId: "student-1",
    schoolYearEnrollmentId: "sye-1",
    enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
    note: null,
  };

  describe("create", () => {
    it("creates an active enrollment with endDate and exitReason defaulting to null", () => {
      const enrollment = Enrollment.create(baseProps);

      expect(enrollment.classId).toBe("class-1");
      expect(enrollment.studentId).toBe("student-1");
      expect(enrollment.endDate).toBeNull();
      expect(enrollment.exitReason).toBeNull();
      expect(enrollment.id).toBeDefined();
      expect(enrollment.createdAt).toBeInstanceOf(Date);
      expect(enrollment.updatedAt).toBeInstanceOf(Date);
    });

    it("accepts both endDate and exitReason set together", () => {
      const enrollment = Enrollment.create({
        ...baseProps,
        endDate: new Date("2026-03-01T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
      });

      expect(enrollment.endDate).toEqual(new Date("2026-03-01T00:00:00.000Z"));
      expect(enrollment.exitReason).toBe(ExitReason.WITHDRAWN);
    });

    it("throws when endDate is set but exitReason is null (XOR invariant)", () => {
      expect(() =>
        Enrollment.create({
          ...baseProps,
          endDate: new Date("2026-03-01T00:00:00.000Z"),
          exitReason: null,
        }),
      ).toThrow(
        "Enrollment endDate and exitReason must both be set or both be null",
      );
    });

    it("throws when exitReason is set but endDate is null (XOR invariant)", () => {
      expect(() =>
        Enrollment.create({
          ...baseProps,
          endDate: null,
          exitReason: ExitReason.WITHDRAWN,
        }),
      ).toThrow(
        "Enrollment endDate and exitReason must both be set or both be null",
      );
    });

    it("throws when classId is empty", () => {
      expect(() => Enrollment.create({ ...baseProps, classId: "" })).toThrow(
        "Class ID is required",
      );
    });

    it("throws when studentId is empty", () => {
      expect(() => Enrollment.create({ ...baseProps, studentId: "" })).toThrow(
        "Student ID is required",
      );
    });

    it("throws when schoolYearEnrollmentId is empty", () => {
      expect(() =>
        Enrollment.create({ ...baseProps, schoolYearEnrollmentId: "" }),
      ).toThrow("School year enrollment ID is required");
    });
  });

  describe("isActive", () => {
    it("returns true when endDate is null", () => {
      const enrollment = Enrollment.create(baseProps);
      expect(enrollment.isActive()).toBe(true);
    });

    it("returns false when endDate is set", () => {
      const enrollment = Enrollment.create({
        ...baseProps,
        endDate: new Date("2026-03-01T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
      });
      expect(enrollment.isActive()).toBe(false);
    });
  });

  describe("withdraw", () => {
    let enrollment: Enrollment;

    beforeEach(() => {
      enrollment = Enrollment.create(baseProps, "enrollment-1");
    });

    it("returns a new entity with endDate and exitReason set", () => {
      const endDate = new Date("2026-03-01T00:00:00.000Z");
      const closed = enrollment.withdraw(endDate, ExitReason.WITHDRAWN);

      expect(closed.endDate).toEqual(endDate);
      expect(closed.exitReason).toBe(ExitReason.WITHDRAWN);
      expect(closed.isActive()).toBe(false);
    });

    it("preserves the same entity id (immutable transition)", () => {
      const closed = enrollment.withdraw(
        new Date("2026-03-01T00:00:00.000Z"),
        ExitReason.WITHDRAWN,
      );
      expect(closed.id).toBe("enrollment-1");
    });

    it("does not mutate the original entity", () => {
      enrollment.withdraw(
        new Date("2026-03-01T00:00:00.000Z"),
        ExitReason.WITHDRAWN,
      );
      expect(enrollment.endDate).toBeNull();
      expect(enrollment.exitReason).toBeNull();
      expect(enrollment.isActive()).toBe(true);
    });

    it("preserves classId, studentId, note, and createdAt", () => {
      const closed = enrollment.withdraw(
        new Date("2026-03-01T00:00:00.000Z"),
        ExitReason.TRANSFERRED,
      );
      expect(closed.classId).toBe(enrollment.classId);
      expect(closed.studentId).toBe(enrollment.studentId);
      expect(closed.note).toBe(enrollment.note);
      expect(closed.createdAt).toEqual(enrollment.createdAt);
    });

    it("throws EnrollmentAlreadyClosedException when called on a closed enrollment", () => {
      const closed = enrollment.withdraw(
        new Date("2026-03-01T00:00:00.000Z"),
        ExitReason.WITHDRAWN,
      );

      expect(() =>
        closed.withdraw(
          new Date("2026-03-15T00:00:00.000Z"),
          ExitReason.WITHDRAWN,
        ),
      ).toThrow(EnrollmentAlreadyClosedException);
    });

    it("throws InvalidEndDateException when endDate is before enrollmentDate", () => {
      expect(() =>
        enrollment.withdraw(
          new Date("2026-01-10T00:00:00.000Z"),
          ExitReason.WITHDRAWN,
        ),
      ).toThrow(InvalidEndDateException);
    });

    it("throws InvalidEndDateException when endDate is in the future", () => {
      const future = new Date();
      future.setUTCDate(future.getUTCDate() + 5);

      expect(() => enrollment.withdraw(future, ExitReason.WITHDRAWN)).toThrow(
        InvalidEndDateException,
      );
    });

    it("accepts endDate equal to today (boundary)", () => {
      const today = new Date();
      // Use a fresh enrollment whose start date is in the past so today is valid.
      const pastEnrollment = Enrollment.create({
        ...baseProps,
        enrollmentDate: new Date("2026-01-01T00:00:00.000Z"),
      });

      expect(() =>
        pastEnrollment.withdraw(today, ExitReason.WITHDRAWN),
      ).not.toThrow();
    });

    it("accepts endDate equal to enrollmentDate (boundary)", () => {
      expect(() =>
        enrollment.withdraw(baseProps.enrollmentDate, ExitReason.TRANSFERRED),
      ).not.toThrow();
    });
  });

  describe("effective status and cancellation", () => {
    const futureProps = {
      ...baseProps,
      enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    };
    const cancelledAt = new Date("2026-07-11T15:30:00.000Z");

    it("derives upcoming, active, and inclusive closed boundaries", () => {
      const enrollment = Enrollment.create({
        ...futureProps,
        endDate: new Date("2026-09-30T00:00:00.000Z"),
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
      const original = Enrollment.create(futureProps, "enrollment-future");
      const cancelled = original.cancel({
        cancelledAt,
        reason: EnrollmentCancellationReason.FAMILY_REQUEST,
        note: "  family moved  ",
        actorId: "user-1",
        actorFullName: "  Casey Admin  ",
      });

      expect(cancelled.id).toBe(original.id);
      expect(cancelled.getEffectiveStatus(cancelledAt)).toBe(
        EnrollmentEffectiveStatus.CANCELLED,
      );
      expect(cancelled.cancelledAt).toEqual(cancelledAt);
      expect(cancelled.cancellationReason).toBe(
        EnrollmentCancellationReason.FAMILY_REQUEST,
      );
      expect(cancelled.cancellationNote).toBe("family moved");
      expect(cancelled.cancelledByUserId).toBe("user-1");
      expect(cancelled.cancelledByFullName).toBe("Casey Admin");
      expect(cancelled.historicalFinalizedAt).toEqual(cancelledAt);
      expect(cancelled.endDate).toBeNull();
      expect(cancelled.exitReason).toBeNull();
      expect(original.cancelledAt).toBeNull();
    });

    it("rejects cancellation metadata without a complete cancellation fact", () => {
      expect(() =>
        Enrollment.create({
          ...futureProps,
          cancellationReason: EnrollmentCancellationReason.OTHER,
        }),
      ).toThrow("Enrollment cancellation details require cancelledAt");

      expect(() =>
        Enrollment.create({
          ...futureProps,
          cancelledAt,
          cancellationReason: EnrollmentCancellationReason.OTHER,
        }),
      ).toThrow(
        "Cancelled enrollment requires cancellationReason and cancelledByUserId",
      );

      expect(() =>
        Enrollment.create({
          ...futureProps,
          cancelledAt,
          cancellationReason: "NOT_A_REASON" as EnrollmentCancellationReason,
          cancelledByUserId: "user-1",
        }),
      ).toThrow("Enrollment cancellationReason is invalid");

      expect(() =>
        Enrollment.create({
          ...futureProps,
          cancelledAt,
          cancellationReason: EnrollmentCancellationReason.OTHER,
          cancelledByUserId: "   ",
        }),
      ).toThrow(
        "Cancelled enrollment requires cancellationReason and cancelledByUserId",
      );
    });

    it("normalizes optional cancellation text and enforces the 500-character limit", () => {
      const cancelled = Enrollment.create({
        ...futureProps,
        cancelledAt,
        cancellationReason: EnrollmentCancellationReason.OTHER,
        cancellationNote: "   ",
        cancelledByUserId: "user-1",
        cancelledByFullName: "  Casey Admin  ",
      });

      expect(cancelled.cancellationNote).toBeNull();
      expect(cancelled.cancelledByFullName).toBe("Casey Admin");
      expect(() =>
        Enrollment.create({
          ...futureProps,
          cancelledAt,
          cancellationReason: EnrollmentCancellationReason.OTHER,
          cancellationNote: "x".repeat(501),
          cancelledByUserId: "user-1",
        }),
      ).toThrow("Enrollment cancellationNote must be at most 500 characters");
    });

    it("rejects cancelling a row once it is effective", () => {
      const active = Enrollment.create(baseProps);

      expect(() =>
        active.cancel({
          cancelledAt: new Date("2026-07-11T15:30:00.000Z"),
          reason: EnrollmentCancellationReason.DATA_ENTRY_ERROR,
          actorId: "user-1",
        }),
      ).toThrow("Only an upcoming enrollment can be cancelled");
    });
  });
});
