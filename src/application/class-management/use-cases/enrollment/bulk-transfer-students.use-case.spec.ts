import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BulkTransferStudentsUseCase } from "./bulk-transfer-students.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { Student } from "@/domain/user-management/entities/student.entity";
import { User } from "@/domain/user-management/user.entity";

const stubActor = User.create({ clerkUid: "user_audit12345" });

describe("BulkTransferStudentsUseCase", () => {
  let useCase: BulkTransferStudentsUseCase;
  let mockEnrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockSyeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const targetClassId = "class-target";
  const sourceClassId = "class-source";
  // Matches `createMockClass({ schoolYearId: "school-year-1", gradeLevelId: "grade-1" })`.
  const targetSchoolYearId = "school-year-1";
  const targetGradeLevelId = "grade-1";
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
        // Per-student parent id so AC-14 can verify each opened row carries
        // the *resolved* parent.id (not a static placeholder).
        schoolYearEnrollmentId: `sye-${studentId}`,
        enrollmentDate: new Date("2025-09-01T00:00:00.000Z"),
        student: Student.create(
          {
            campusId,
            studentCode: `STU-${studentId}`,
            fullName: `Student ${studentId}`,
            nickname: null,
            email: null,
            phoneNumber: null,
            address: null,
            dateOfBirth: null,
            gender: null,
          },
          studentId,
        ),
      },
      `active-${studentId}`,
    );

  /**
   * Build an open parent SchoolYearEnrollment for `studentId` that matches
   * the target class (school year, grade level) by default. Per-student
   * `parent.id = sye-<studentId>` so AC-14 happy-path can assert each opened
   * row threads the right parent.
   */
  const createMockParent = (
    studentId: string,
    overrides: { gradeLevelId?: string } = {},
  ): SchoolYearEnrollment =>
    SchoolYearEnrollment.create(
      {
        studentId,
        campusId,
        schoolYearId: targetSchoolYearId,
        gradeLevelId: overrides.gradeLevelId ?? targetGradeLevelId,
        enrollmentDate: new Date("2025-08-15T00:00:00.000Z"),
        exitDate: null,
        exitReason: null,
        note: null,
      },
      `sye-${studentId}`,
    );

  beforeEach(() => {
    mockEnrollmentRepository = {
      findById: jest.fn(),
      findByStudentClassDate: jest.fn(),
      findEffectiveByStudentIdAt: jest.fn(),
      findUpcomingByStudentId: jest.fn(),
      findStructurallyOpenByStudentId: jest.fn(),
      findOverlappingByStudentId: jest.fn(),
      findBySchoolYearEnrollmentId: jest.fn(),
      findByClassId: jest.fn(),
      findByStudentId: jest.fn(),
      findActiveByStudentId: jest.fn(),
      findByClassIdAndEffectiveStatus: jest.fn(),
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

    mockSyeRepository = {
      findById: jest.fn(),
      findOpenByStudentAndSchoolYear: jest.fn(),
      findStructurallyOpenByStudentAndSchoolYear: jest.fn(),
      findCoveringDateByStudentAndSchoolYear: jest.fn(),
      findUpcomingByStudentAndSchoolYear: jest.fn(),
      findLatestByStudentAndSchoolYear: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAllByStudentIdWithChildCount: jest.fn(),
      findStudentsBySchoolYear: jest.fn(),
      countChildEnrollments: jest.fn(),
      correctGradeLevel: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      withdrawWithChildren: jest.fn(),
    } as jest.Mocked<SchoolYearEnrollmentRepository>;

    useCase = new BulkTransferStudentsUseCase(
      mockEnrollmentRepository,
      mockClassRepository,
      mockSyeRepository,
    );

    // Default: transferEnrollment echoes back the pair as if persisted.
    mockEnrollmentRepository.transferEnrollment.mockImplementation(
      async (closed, opened) => ({ closed, opened }),
    );

    // Default per-student parent matches the target class's grade level so
    // existing tests stay green. Tests that exercise AC-19 override the
    // implementation for a specific studentId.
    mockSyeRepository.findOpenByStudentAndSchoolYear.mockImplementation(
      async (studentId) => createMockParent(studentId),
    );
    mockSyeRepository.findCoveringDateByStudentAndSchoolYear.mockImplementation(
      (studentId, schoolYearId) =>
        mockSyeRepository.findOpenByStudentAndSchoolYear(
          studentId,
          schoolYearId,
        ),
    );
    mockEnrollmentRepository.findEffectiveByStudentIdAt.mockImplementation(
      (studentId) => mockEnrollmentRepository.findActiveByStudentId(studentId),
    );
    mockEnrollmentRepository.findOverlappingByStudentId.mockResolvedValue(null);
  });

  // -------- Whole-call validation (FR-10) — short-circuits before row work --------

  describe("whole-call validation", () => {
    it("throws BATCH_EMPTY when students is empty (AC-18)", async () => {
      await expect(
        useCase.execute(
          {
            campusId,
            classId: targetClassId,
            transferDate,
            students: [],
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            campusId,
            classId: targetClassId,
            transferDate,
            students,
          },
          stubActor,
        ),
      ).rejects.toThrow(new BadRequestException("BATCH_TOO_LARGE"));

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("throws DUPLICATE_STUDENT_IN_BATCH when payload contains the same studentId twice (AC-18)", async () => {
      await expect(
        useCase.execute(
          {
            campusId,
            classId: targetClassId,
            transferDate,
            students: [
              { studentId: "s-1" },
              { studentId: "s-2" },
              { studentId: "s-1" },
            ],
          },
          stubActor,
        ),
      ).rejects.toThrow(new BadRequestException("DUPLICATE_STUDENT_IN_BATCH"));

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when target class does not exist (AC-17)", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          {
            campusId,
            classId: targetClassId,
            transferDate,
            students: [{ studentId: "s-1" }],
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            campusId,
            classId: targetClassId,
            transferDate,
            students: [{ studentId: "s-1" }],
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            campusId,
            classId: targetClassId,
            transferDate: new Date("2026-07-15T00:00:00.000Z"),
            students: [{ studentId: "s-1" }],
          },
          stubActor,
        ),
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

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-1" }],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toMatchObject([
        { studentId: "s-1", reason: "NO_ACTIVE_ENROLLMENT" },
      ]);
      expect(result.skipped[0].context).toMatchObject({
        targetClass: { id: targetClassId, name: "Lớp Y2-A" },
        activeEnrollment: null,
      });
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("pushes TRANSFER_SOURCE_MISMATCH only when fromClassId is provided and ≠ active.classId", async () => {
      // fromClassId provided and mismatches → skip.
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        createActiveEnrollment("s-mismatch", "class-Y1-B"),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-mismatch", fromClassId: "class-Y1-A" }],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toMatchObject([
        { studentId: "s-mismatch", reason: "TRANSFER_SOURCE_MISMATCH" },
      ]);
      expect(result.skipped[0].context).toMatchObject({
        targetClass: { id: targetClassId, name: "Lớp Y2-A" },
        activeEnrollment: { classId: "class-Y1-B" },
      });
    });

    it("does NOT fire TRANSFER_SOURCE_MISMATCH when fromClassId is omitted (any source is accepted)", async () => {
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        createActiveEnrollment("s-ok", "class-any-source"),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-ok" }],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(1);
      expect(result.skipped).toHaveLength(0);
    });

    it("pushes TRANSFER_SAME_CLASS when active.classId === target classId", async () => {
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        createActiveEnrollment("s-same", targetClassId),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-same" }],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toMatchObject([
        { studentId: "s-same", reason: "TRANSFER_SAME_CLASS" },
      ]);
      expect(result.skipped[0].context).toMatchObject({
        targetClass: { id: targetClassId, name: "Lớp Y2-A" },
        activeEnrollment: { classId: targetClassId },
      });
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

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: studentIds.map((studentId) => ({ studentId })),
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(4);
      expect(result.skipped).toHaveLength(0);
      expect(mockEnrollmentRepository.transferEnrollment).toHaveBeenCalledTimes(
        4,
      );

      // Every source row closes on the prior UTC date so the inclusive
      // periods do not overlap; every target row starts on transferDate.
      // Every opened row lands in the target class with endDate=null AND
      // threads the per-student resolved parent.id (AC-19 / AC-4).
      const openedParentIds: string[] = [];
      for (const call of mockEnrollmentRepository.transferEnrollment.mock
        .calls) {
        const [closed, opened] = call as [Enrollment, Enrollment];
        expect(closed.endDate?.getTime()).toBe(
          transferDate.getTime() - 24 * 60 * 60 * 1000,
        );
        expect(closed.exitReason).toBe(ExitReason.TRANSFERRED);
        expect(opened.classId).toBe(targetClassId);
        expect(opened.endDate).toBeNull();
        expect(opened.enrollmentDate.getTime()).toBe(transferDate.getTime());
        openedParentIds.push(opened.schoolYearEnrollmentId);
      }
      expect(openedParentIds).toEqual(studentIds.map((id) => `sye-${id}`));
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

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [
            { studentId: "s-ok-1" },
            { studentId: "s-no-active" },
            { studentId: "s-ok-2" },
            { studentId: "s-already-target" },
          ],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(2);
      expect(result.skipped).toMatchObject([
        { studentId: "s-no-active", reason: "NO_ACTIVE_ENROLLMENT" },
        { studentId: "s-already-target", reason: "TRANSFER_SAME_CLASS" },
      ]);
      expect(mockEnrollmentRepository.transferEnrollment).toHaveBeenCalledTimes(
        2,
      );
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

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: studentIds.map((studentId) => ({ studentId })),
        },
        stubActor,
      );

      // Rows 1-4 + row 6 persisted; row 5 in skipped[] with TRANSFER_FAILED.
      expect(result.transferred).toHaveLength(5);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toMatchObject({
        studentId: "s-5",
        reason: "TRANSFER_FAILED",
        message: "Simulated DB rollback on row 5",
      });
      // Critically — the loop continued past the failure (called all 6 times).
      expect(mockEnrollmentRepository.transferEnrollment).toHaveBeenCalledTimes(
        6,
      );
    });

    it("per-row note overrides batch note; omitted per-row note inherits batch note", async () => {
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) => createActiveEnrollment(id),
      );

      await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          note: "Batch note",
          students: [
            { studentId: "s-inherits" },
            { studentId: "s-overrides", note: "Per-row note" },
          ],
        },
        stubActor,
      );

      const calls = mockEnrollmentRepository.transferEnrollment.mock.calls;
      const [, openedInherits] = calls[0] as [Enrollment, Enrollment];
      const [, openedOverrides] = calls[1] as [Enrollment, Enrollment];

      expect(openedInherits.note).toBe("Batch note");
      expect(openedOverrides.note).toBe("Per-row note");
    });
  });

  // -------- Preflight + per-row error mapping (AC-6..AC-8) ----------

  describe("preflight + per-row error mapping", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) => createActiveEnrollment(id),
      );
      // Default: no existing row on the (studentId, classId, date) tuple.
      // Individual tests override.
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("AC-6 preflight hit: skips with ENROLLMENT_PERIOD_OVERLAP and does NOT call transferEnrollment", async () => {
      mockEnrollmentRepository.findOverlappingByStudentId.mockResolvedValue(
        Enrollment.create(
          {
            classId: targetClassId,
            studentId: "s-pre",
            schoolYearEnrollmentId: "sye-test",
            enrollmentDate: transferDate,
          },
          "existing-row",
        ),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-pre" }],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toMatchObject([
        { studentId: "s-pre", reason: "ENROLLMENT_PERIOD_OVERLAP" },
      ]);
      expect(
        mockEnrollmentRepository.findOverlappingByStudentId,
      ).toHaveBeenCalledWith("s-pre", transferDate, null, "active-s-pre");
      expect(
        mockEnrollmentRepository.transferEnrollment,
      ).not.toHaveBeenCalled();
    });

    it("AC-7 P2002 race: maps the persistence race to ENROLLMENT_PERIOD_OVERLAP and logs a warning", async () => {
      mockEnrollmentRepository.transferEnrollment.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
          meta: {
            modelName: "Enrollment",
            target: "idx_enrollment_unique_uncancelled_start",
          },
        }),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-race" }],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toMatchObject([
        { studentId: "s-race", reason: "ENROLLMENT_PERIOD_OVERLAP" },
      ]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0][0] as string;
      expect(message).toContain(targetClassId);
      expect(message).toContain("s-race");
      expect(message).toContain("overlap race");
    });

    it("AC-8 generic failure: maps non-P2002 error to TRANSFER_FAILED with message and logs a warning", async () => {
      mockEnrollmentRepository.transferEnrollment.mockRejectedValue(
        new Error("boom"),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-fail" }],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(0);
      expect(result.skipped).toMatchObject([
        {
          studentId: "s-fail",
          reason: "TRANSFER_FAILED",
          message: "boom",
        },
      ]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0][0] as string;
      expect(message).toContain(targetClassId);
      expect(message).toContain("s-fail");
      expect(message).toContain("boom");
    });
  });

  // -------- AC-19: per-row parent grade-match gate (Scenario 9) ----------

  describe("AC-19 / Scenario 9: per-row parent grade-match gate", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) => createActiveEnrollment(id),
      );
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("pushes GRADE_LEVEL_MISMATCH to skipped[] for the offending row only — survivors transfer", async () => {
      // Only `s-wrong-grade` has a parent in a different grade. The other
      // two students fall through to the default parent (matching grade).
      mockSyeRepository.findOpenByStudentAndSchoolYear.mockImplementation(
        async (id) => {
          if (id === "s-wrong-grade") {
            return createMockParent(id, { gradeLevelId: "grade-OTHER" });
          }
          return createMockParent(id);
        },
      );

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [
            { studentId: "s-ok-1" },
            { studentId: "s-wrong-grade" },
            { studentId: "s-ok-2" },
          ],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(2);
      expect(result.skipped).toMatchObject([
        {
          studentId: "s-wrong-grade",
          reason: SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH,
        },
      ]);
      expect(result.skipped[0].context).toMatchObject({
        targetClass: { id: targetClassId, name: "Lớp Y2-A" },
        activeEnrollment: { classId: sourceClassId },
        schoolYearEnrollment: { gradeLevelId: "grade-OTHER" },
      });
      expect(JSON.stringify(result.skipped[0].context)).not.toContain(
        "attendance",
      );
      expect(
        JSON.stringify(mockEnrollmentRepository.transferEnrollment.mock.calls),
      ).not.toContain("attendance");
      // transferEnrollment fired exactly twice — once per survivor.
      expect(mockEnrollmentRepository.transferEnrollment).toHaveBeenCalledTimes(
        2,
      );
    });

    it("pushes NO_SCHOOL_YEAR_ENROLLMENT to skipped[] when parent is missing (data-integrity degrade) — survivors transfer", async () => {
      // Only `s-no-parent` returns null — bulk degrades to per-row skip
      // rather than aborting the whole batch (FR-11).
      mockSyeRepository.findOpenByStudentAndSchoolYear.mockImplementation(
        async (id) => {
          if (id === "s-no-parent") return null;
          return createMockParent(id);
        },
      );

      const result = await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [
            { studentId: "s-ok-1" },
            { studentId: "s-no-parent" },
            { studentId: "s-ok-2" },
          ],
        },
        stubActor,
      );

      expect(result.transferred).toHaveLength(2);
      expect(result.skipped).toMatchObject([
        {
          studentId: "s-no-parent",
          reason: SchoolYearEnrollmentErrorCode.NO_SCHOOL_YEAR_ENROLLMENT,
        },
      ]);
      expect(result.skipped[0].context).toMatchObject({
        targetClass: { id: targetClassId, name: "Lớp Y2-A" },
        activeEnrollment: { classId: sourceClassId },
        schoolYearEnrollment: null,
      });
      expect(JSON.stringify(result.skipped[0].context)).not.toContain(
        "attendance",
      );
      expect(
        JSON.stringify(mockEnrollmentRepository.transferEnrollment.mock.calls),
      ).not.toContain("attendance");
      // Warning logged for the data-integrity row.
      expect(warnSpy).toHaveBeenCalled();
      expect(mockEnrollmentRepository.transferEnrollment).toHaveBeenCalledTimes(
        2,
      );
    });

    it("resolves each row's parent against the *target* class's schoolYearId (D3)", async () => {
      await useCase.execute(
        {
          campusId,
          classId: targetClassId,
          transferDate,
          students: [{ studentId: "s-1" }, { studentId: "s-2" }],
        },
        stubActor,
      );

      const calls = mockSyeRepository.findOpenByStudentAndSchoolYear.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual(["s-1", targetSchoolYearId]);
      expect(calls[1]).toEqual(["s-2", targetSchoolYearId]);
    });
  });
});
