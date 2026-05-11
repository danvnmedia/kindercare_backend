import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { TransferStudentUseCase } from "./transfer-student.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

describe("TransferStudentUseCase", () => {
  let useCase: TransferStudentUseCase;
  let enrollmentRepo: jest.Mocked<EnrollmentRepository>;
  let classRepo: jest.Mocked<ClassRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const studentId = "student-1";
  const sourceClassId = "class-source";
  const targetClassId = "class-target";
  // Stable past start date so default-today is always > active.enrollmentDate
  // and AC-19 future-date tests stay well-defined.
  const activeEnrollmentDate = new Date("2024-09-01T00:00:00.000Z");

  const wideRange = {
    startDate: new Date("2020-01-01T00:00:00.000Z"),
    endDate: new Date("2030-12-31T00:00:00.000Z"),
  };

  const buildClass = (
    id: string,
    overrides: {
      campusId?: string;
      schoolYearRange?: { startDate: Date; endDate: Date };
    } = {},
  ): Class => {
    const owner = overrides.campusId ?? campusId;
    const range = overrides.schoolYearRange ?? wideRange;
    const schoolYear = SchoolYear.create(
      {
        campusId: owner,
        name: "Test School Year",
        startDate: range.startDate,
        endDate: range.endDate,
      },
      `school-year-${id}`,
    );
    return Class.create(
      {
        name: `Test Class ${id}`,
        campusId: owner,
        gradeLevelId: "grade-level-1",
        schoolYearId: `school-year-${id}`,
        description: null,
        schoolYear,
      },
      id,
    );
  };

  const buildActiveEnrollment = (
    overrides: { classId?: string; enrollmentDate?: Date } = {},
  ): Enrollment =>
    Enrollment.create(
      {
        classId: overrides.classId ?? sourceClassId,
        studentId,
        enrollmentDate: overrides.enrollmentDate ?? activeEnrollmentDate,
        endDate: null,
        exitReason: null,
        note: null,
      },
      "active-1",
    );

  beforeEach(() => {
    enrollmentRepo = {
      findById: jest.fn(),
      findByStudentClassDate: jest.fn(),
      findByClassId: jest.fn(),
      findByStudentId: jest.fn(),
      findActiveByStudentId: jest.fn(),
      findActiveByClassId: jest.fn(),
      findHistoricalByClassId: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      transferEnrollment: jest.fn(),
      saveMany: jest.fn(),
    } as jest.Mocked<EnrollmentRepository>;

    classRepo = {
      findById: jest.fn(),
      findByNameInContextAndCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findByGradeLevelId: jest.fn(),
      findBySchoolYearId: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<ClassRepository>;

    useCase = new TransferStudentUseCase(enrollmentRepo, classRepo);
  });

  describe("AC-14 / AC-15: happy path returns { closed, opened }", () => {
    it("defaults transferDate to today and sets closed.exitReason=TRANSFERRED, opened.endDate=null", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      enrollmentRepo.transferEnrollment.mockImplementation(
        async (closed, opened) => ({ closed, opened }),
      );

      const result = await useCase.execute({
        studentId,
        toClassId: targetClassId,
        campusId,
      });

      expect(result.closed.exitReason).toBe(ExitReason.TRANSFERRED);
      expect(result.closed.endDate).not.toBeNull();
      expect(result.closed.classId).toBe(sourceClassId);
      expect(result.opened.classId).toBe(targetClassId);
      expect(result.opened.endDate).toBeNull();
      expect(result.opened.exitReason).toBeNull();
      expect(enrollmentRepo.transferEnrollment).toHaveBeenCalledTimes(1);
    });

    it("honors an explicit transferDate on both rows (AC-15)", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      enrollmentRepo.transferEnrollment.mockImplementation(
        async (closed, opened) => ({ closed, opened }),
      );
      const explicit = new Date("2025-03-15T00:00:00.000Z");

      const result = await useCase.execute({
        studentId,
        toClassId: targetClassId,
        campusId,
        transferDate: explicit,
        note: "moved",
      });

      // Domain compares date-only — assert UTC date components.
      const dateOnly = (d: Date) =>
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      expect(dateOnly(result.closed.endDate!)).toBe(dateOnly(explicit));
      expect(dateOnly(result.opened.enrollmentDate)).toBe(dateOnly(explicit));
      expect(result.opened.note).toBe("moved");
    });
  });

  describe("AC-16: same-class transfer rejection", () => {
    it("throws ConflictException TRANSFER_SAME_CLASS when toClassId === active.classId", async () => {
      classRepo.findById.mockResolvedValue(buildClass(sourceClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );

      await expect(
        useCase.execute({
          studentId,
          toClassId: sourceClassId,
          campusId,
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute({
          studentId,
          toClassId: sourceClassId,
          campusId,
        }),
      ).rejects.toThrow("TRANSFER_SAME_CLASS");

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });
  });

  describe("AC-17: source-mismatch", () => {
    it("throws ConflictException TRANSFER_SOURCE_MISMATCH when fromClassId disagrees with active", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          fromClassId: "wrong-source",
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          fromClassId: "wrong-source",
        }),
      ).rejects.toThrow("TRANSFER_SOURCE_MISMATCH");

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });

    it("accepts a matching fromClassId without complaining", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      enrollmentRepo.transferEnrollment.mockImplementation(
        async (closed, opened) => ({ closed, opened }),
      );

      const result = await useCase.execute({
        studentId,
        toClassId: targetClassId,
        campusId,
        fromClassId: sourceClassId,
      });

      expect(result.opened.classId).toBe(targetClassId);
      expect(enrollmentRepo.transferEnrollment).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-18: no active enrollment", () => {
    it("throws ConflictException NO_ACTIVE_ENROLLMENT when student has no open period", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(null);

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
        }),
      ).rejects.toThrow("NO_ACTIVE_ENROLLMENT");

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });
  });

  describe("AC-19: invalid transfer date", () => {
    it("rejects transferDate before active.enrollmentDate with INVALID_TRANSFER_DATE", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      const tooEarly = new Date("2024-08-01T00:00:00.000Z");

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          transferDate: tooEarly,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          transferDate: tooEarly,
        }),
      ).rejects.toThrow(/INVALID_TRANSFER_DATE/);

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });

    it("rejects transferDate in the future with INVALID_TRANSFER_DATE", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          transferDate: oneWeekFromNow,
        }),
      ).rejects.toThrow(/INVALID_TRANSFER_DATE/);

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });
  });

  describe("AC-28: transferDate outside target school year", () => {
    it("rejects transferDate before target schoolYear.startDate", async () => {
      classRepo.findById.mockResolvedValue(
        buildClass(targetClassId, {
          schoolYearRange: {
            startDate: new Date("2025-09-01T00:00:00.000Z"),
            endDate: new Date("2026-06-30T00:00:00.000Z"),
          },
        }),
      );
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          // 2025-08-15 is well after the active.enrollmentDate (2024-09-01)
          // and before today, so it ONLY trips the school-year bound.
          transferDate: new Date("2025-08-15T00:00:00.000Z"),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          transferDate: new Date("2025-08-15T00:00:00.000Z"),
        }),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });

    it("rejects transferDate after target schoolYear.endDate", async () => {
      classRepo.findById.mockResolvedValue(
        buildClass(targetClassId, {
          schoolYearRange: {
            // Past school year so its endDate is before "today" — keeps AC-19
            // (no future date) from masking AC-28.
            startDate: new Date("2023-09-01T00:00:00.000Z"),
            endDate: new Date("2024-06-30T00:00:00.000Z"),
          },
        }),
      );
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment({
          enrollmentDate: new Date("2023-10-01T00:00:00.000Z"),
        }),
      );

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          // After the (past) schoolYear ended, but still before today.
          transferDate: new Date("2024-08-15T00:00:00.000Z"),
        }),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });
  });

  describe("cross-campus rejection (404 hide-existence)", () => {
    it("throws NotFoundException when target class belongs to a different campus", async () => {
      classRepo.findById.mockResolvedValue(
        buildClass(targetClassId, { campusId: otherCampusId }),
      );

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(enrollmentRepo.findActiveByStudentId).not.toHaveBeenCalled();
      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when target class does not exist", async () => {
      classRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(enrollmentRepo.findActiveByStudentId).not.toHaveBeenCalled();
      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });
  });

  describe("validation order", () => {
    it("school-year bounds fire before withdraw's date validation when both would fail", async () => {
      // Set target schoolYear to a window that excludes the explicit transferDate;
      // the same date is also "before active.enrollmentDate" so withdraw would
      // ALSO throw INVALID_END_DATE. Spec says school-year fires first.
      classRepo.findById.mockResolvedValue(
        buildClass(targetClassId, {
          schoolYearRange: {
            startDate: new Date("2025-09-01T00:00:00.000Z"),
            endDate: new Date("2026-06-30T00:00:00.000Z"),
          },
        }),
      );
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );

      await expect(
        useCase.execute({
          studentId,
          toClassId: targetClassId,
          campusId,
          transferDate: new Date("2024-01-01T00:00:00.000Z"),
        }),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");
    });

    it("does not call transferEnrollment when any earlier validation fails", async () => {
      classRepo.findById.mockResolvedValue(buildClass(sourceClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );

      // Same-class case
      await expect(
        useCase.execute({
          studentId,
          toClassId: sourceClassId,
          campusId,
        }),
      ).rejects.toThrow(ConflictException);

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });
  });
});
