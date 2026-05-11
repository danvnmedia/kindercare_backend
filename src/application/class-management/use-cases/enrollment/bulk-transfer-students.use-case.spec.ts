import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BulkTransferStudentsUseCase } from "./bulk-transfer-students.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

describe("BulkTransferStudentsUseCase", () => {
  let useCase: BulkTransferStudentsUseCase;
  let mockEnrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const targetClassId = "class-target";
  const sourceClassId = "class-source";
  // Must be after the active enrollment's enrollmentDate (2025-09-01) AND
  // not in the future — `Enrollment.withdraw` enforces both invariants.
  const transferDate = new Date("2026-03-15T00:00:00.000Z");

  // Wide default SY range so happy-path tests pass; bounds tests pass an
  // explicit narrow range.
  const createMockClass = (
    overrides: {
      id?: string;
      campusId?: string;
      schoolYearRange?: { startDate: Date; endDate: Date };
    } = {},
  ): Class => {
    const ownerCampusId = overrides.campusId ?? campusId;
    const range = overrides.schoolYearRange ?? {
      startDate: new Date("2020-01-01T00:00:00.000Z"),
      endDate: new Date("2030-12-31T00:00:00.000Z"),
    };
    const schoolYear = SchoolYear.create(
      {
        campusId: ownerCampusId,
        name: "SY-25-26",
        startDate: range.startDate,
        endDate: range.endDate,
      },
      "school-year-1",
    );
    return Class.create(
      {
        name: "Lớp Y2-A",
        campusId: ownerCampusId,
        gradeLevelId: "grade-1",
        schoolYearId: "school-year-1",
        description: null,
        schoolYear,
      },
      overrides.id ?? targetClassId,
    );
  };

  /** Stand-in for the student's currently active enrollment in a source class. */
  const createActiveEnrollment = (
    studentId: string,
    classId: string = sourceClassId,
  ): Enrollment =>
    Enrollment.create(
      {
        classId,
        studentId,
        enrollmentDate: new Date("2025-09-01T00:00:00.000Z"),
      },
      `active-${studentId}`,
    );

  beforeEach(() => {
    mockEnrollmentRepository = {
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

    mockClassRepository = {
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

    useCase = new BulkTransferStudentsUseCase(
      mockEnrollmentRepository,
      mockClassRepository,
    );

    // Default: transferEnrollment echoes back the pair as if persisted.
    mockEnrollmentRepository.transferEnrollment.mockImplementation(
      async (closed, opened) => ({ closed, opened }),
    );
  });

  // -------- Whole-call validation (FR-10) — short-circuits before row work --------

  describe("whole-call validation", () => {
    it("throws BATCH_EMPTY when students is empty (AC-18)", async () => {
      await expect(
        useCase.execute({
          campusId,
          classId: targetClassId,
          transferDate,
          students: [],
        }),
      ).rejects.toThrow(new BadRequestException("BATCH_EMPTY"));

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("throws BATCH_TOO_LARGE when students exceeds 100 (AC-18)", async () => {
      const students = Array.from({ length: 101 }, (_, i) => ({
        studentId: `s-${i}`,
      }));

      await expect(
        useCase.execute({
          campusId,
          classId: targetClassId,
          transferDate,
          students,
        }),
      ).rejects.toThrow(new BadRequestException("BATCH_TOO_LARGE"));

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("throws DUPLICATE_STUDENT_IN_BATCH when payload contains the same studentId twice (AC-18)", async () => {
      await expect(
        useCase.execute({
          campusId,
          classId: targetClassId,
          transferDate,
          students: [
            { studentId: "s-1" },
            { studentId: "s-2" },
            { studentId: "s-1" },
          ],
        }),
      ).rejects.toThrow(new BadRequestException("DUPLICATE_STUDENT_IN_BATCH"));

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when target class does not exist (AC-17)", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-1" }],
        }),
      ).rejects.toThrow(
        new NotFoundException(`Class with ID ${targetClassId} not found`),
      );

      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("throws NotFoundException with the SAME body for a cross-campus target class (AC-17, D5)", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass({ campusId: otherCampusId }),
      );

      await expect(
        useCase.execute({
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-1" }],
        }),
      ).rejects.toThrow(
        new NotFoundException(`Class with ID ${targetClassId} not found`),
      );

      // Critically — per-row work never starts (whole-call abort).
      expect(
        mockEnrollmentRepository.findActiveByStudentId,
      ).not.toHaveBeenCalled();
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("throws ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR when transferDate is outside the target schoolYear range (AC-17)", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass({
          schoolYearRange: {
            startDate: new Date("2025-09-01T00:00:00.000Z"),
            endDate: new Date("2026-06-30T00:00:00.000Z"),
          },
        }),
      );

      await expect(
        useCase.execute({
          campusId,
          classId: targetClassId,
          transferDate: new Date("2026-07-15T00:00:00.000Z"),
          students: [{ studentId: "s-1" }],
        }),
      ).rejects.toThrow(
        new BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR"),
      );

      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });
  });

  // -------- Per-row validation (FR-11) — tolerant; survivors persist ----------

  describe("per-row validation", () => {
    beforeEach(() => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
    });

    it("pushes NO_ACTIVE_ENROLLMENT to skipped when student has no active enrollment", async () => {
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);

      const result = await useCase.execute({
        campusId,
        classId: targetClassId,
        transferDate,
        students: [{ studentId: "s-1" }],
      });

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toEqual([
        { studentId: "s-1", reason: "NO_ACTIVE_ENROLLMENT" },
      ]);
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("pushes TRANSFER_SOURCE_MISMATCH only when fromClassId is provided and ≠ active.classId", async () => {
      // fromClassId provided and mismatches → skip.
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        createActiveEnrollment("s-mismatch", "class-Y1-B"),
      );

      const result = await useCase.execute({
        campusId,
        classId: targetClassId,
        transferDate,
        students: [{ studentId: "s-mismatch", fromClassId: "class-Y1-A" }],
      });

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toEqual([
        { studentId: "s-mismatch", reason: "TRANSFER_SOURCE_MISMATCH" },
      ]);
    });

    it("does NOT fire TRANSFER_SOURCE_MISMATCH when fromClassId is omitted (any source is accepted)", async () => {
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        createActiveEnrollment("s-ok", "class-any-source"),
      );

      const result = await useCase.execute({
        campusId,
        classId: targetClassId,
        transferDate,
        students: [{ studentId: "s-ok" }],
      });

      expect(result.transferred).toHaveLength(1);
      expect(result.skipped).toHaveLength(0);
    });

    it("pushes TRANSFER_SAME_CLASS when active.classId === target classId", async () => {
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        createActiveEnrollment("s-same", targetClassId),
      );

      const result = await useCase.execute({
        campusId,
        classId: targetClassId,
        transferDate,
        students: [{ studentId: "s-same" }],
      });

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toEqual([
        { studentId: "s-same", reason: "TRANSFER_SAME_CLASS" },
      ]);
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });
  });

  // -------- Happy path / mixed batch / per-row independence (AC-14..AC-16) ----

  describe("end-to-end batches", () => {
    beforeEach(() => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
    });

    it("AC-14 happy path: 4 students all active elsewhere → transferred=4, skipped=0", async () => {
      const studentIds = ["s-1", "s-2", "s-3", "s-4"];
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) => createActiveEnrollment(id),
      );

      const result = await useCase.execute({
        campusId,
        classId: targetClassId,
        transferDate,
        students: studentIds.map((studentId) => ({ studentId })),
      });

      expect(result.transferred).toHaveLength(4);
      expect(result.skipped).toHaveLength(0);
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).toHaveBeenCalledTimes(4);

      // Every closed row carries the transfer date + TRANSFERRED reason.
      // Every opened row lands in the target class with endDate=null.
      for (const call of mockEnrollmentRepository.transferEnrollment.mock
        .calls) {
        const [closed, opened] = call as [Enrollment, Enrollment];
        expect(closed.endDate?.getTime()).toBe(transferDate.getTime());
        expect(closed.exitReason).toBe(ExitReason.TRANSFERRED);
        expect(opened.classId).toBe(targetClassId);
        expect(opened.endDate).toBeNull();
        expect(opened.enrollmentDate.getTime()).toBe(transferDate.getTime());
      }
    });

    it("AC-15 mixed batch: 2 active elsewhere + 1 no-active + 1 already in target → transferred=2, skipped reasons surfaced", async () => {
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) => {
          if (id === "s-no-active") return null;
          if (id === "s-already-target")
            return createActiveEnrollment(id, targetClassId);
          return createActiveEnrollment(id);
        },
      );

      const result = await useCase.execute({
        campusId,
        classId: targetClassId,
        transferDate,
        students: [
          { studentId: "s-ok-1" },
          { studentId: "s-no-active" },
          { studentId: "s-ok-2" },
          { studentId: "s-already-target" },
        ],
      });

      expect(result.transferred).toHaveLength(2);
      expect(result.skipped).toEqual([
        { studentId: "s-no-active", reason: "NO_ACTIVE_ENROLLMENT" },
        { studentId: "s-already-target", reason: "TRANSFER_SAME_CLASS" },
      ]);
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).toHaveBeenCalledTimes(2);
    });

    it("AC-16 per-row independence: row 5 DB error leaves rows 1-4 persisted and the loop continues", async () => {
      const studentIds = ["s-1", "s-2", "s-3", "s-4", "s-5", "s-6"];
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) => createActiveEnrollment(id),
      );

      // First 4 succeed (default echo), 5th rejects, 6th succeeds again.
      let call = 0;
      mockEnrollmentRepository.transferEnrollment.mockImplementation(
        async (closed, opened) => {
          call += 1;
          if (call === 5) {
            throw new Error("Simulated DB rollback on row 5");
          }
          return { closed, opened };
        },
      );

      const result = await useCase.execute({
        campusId,
        classId: targetClassId,
        transferDate,
        students: studentIds.map((studentId) => ({ studentId })),
      });

      // Rows 1-4 + row 6 persisted; row 5 in skipped[] with TRANSFER_FAILED.
      expect(result.transferred).toHaveLength(5);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toEqual({
        studentId: "s-5",
        reason: "TRANSFER_FAILED",
        message: "Simulated DB rollback on row 5",
      });
      // Critically — the loop continued past the failure (called all 6 times).
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).toHaveBeenCalledTimes(6);
    });

    it("per-row note overrides batch note; omitted per-row note inherits batch note", async () => {
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) => createActiveEnrollment(id),
      );

      await useCase.execute({
        campusId,
        classId: targetClassId,
        transferDate,
        note: "Batch note",
        students: [
          { studentId: "s-inherits" },
          { studentId: "s-overrides", note: "Per-row note" },
        ],
      });

      const calls =
        mockEnrollmentRepository.transferEnrollment.mock.calls;
      const [, openedInherits] = calls[0] as [Enrollment, Enrollment];
      const [, openedOverrides] = calls[1] as [Enrollment, Enrollment];

      expect(openedInherits.note).toBe("Batch note");
      expect(openedOverrides.note).toBe("Per-row note");
    });
  });
});
