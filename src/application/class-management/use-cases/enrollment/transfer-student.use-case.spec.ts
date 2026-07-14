import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { TransferStudentUseCase } from "./transfer-student.use-case";
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
import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";

const stubActor = User.reconstitute(
  {
    clerkUid: "user_audit12345",
    isActive: true,
    profile: {
      type: "staff",
      id: "actor-1",
      fullName: "Alice Nguyen",
      email: null,
      phoneNumber: null,
      dateOfBirth: null,
      gender: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "actor-1",
);

const stubTx = {} as unknown as AppTransactionClient;

describe("TransferStudentUseCase", () => {
  let useCase: TransferStudentUseCase;
  let enrollmentRepo: jest.Mocked<EnrollmentRepository>;
  let classRepo: jest.Mocked<ClassRepository>;
  let syeRepo: jest.Mocked<SchoolYearEnrollmentRepository>;
  let runner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const studentId = "student-1";
  const sourceClassId = "class-source";
  const targetClassId = "class-target";
  const parentId = "sye-target";
  // `buildClass(targetClassId)` produces a class whose `schoolYearId` follows
  // the `school-year-<classId>` template; the parent must resolve under the
  // *target* class's school year (D3).
  const targetSchoolYearId = `school-year-${targetClassId}`;
  // Matches `Class.create({ gradeLevelId: "grade-level-1", ... })` in
  // `buildClass`; mismatch tests pass a different value.
  const targetGradeLevelId = "grade-level-1";
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
        schoolYearEnrollmentId: parentId,
        enrollmentDate: overrides.enrollmentDate ?? activeEnrollmentDate,
        endDate: null,
        exitReason: null,
        note: null,
        student: Student.create(
          {
            campusId,
            studentCode: "STU-001",
            fullName: "Snapshot Student",
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
      "active-1",
    );

  /**
   * Build an open parent SchoolYearEnrollment that matches the target class
   * (campus, school year, grade level) by default. Tests override
   * `gradeLevelId` to drive the grade-mismatch path (AC-19 / Scenario 9).
   */
  const createMockParent = (
    overrides: { gradeLevelId?: string } = {},
  ): SchoolYearEnrollment =>
    SchoolYearEnrollment.create(
      {
        studentId,
        campusId,
        schoolYearId: targetSchoolYearId,
        gradeLevelId: overrides.gradeLevelId ?? targetGradeLevelId,
        enrollmentDate: new Date("2024-08-15T00:00:00.000Z"),
        exitDate: null,
        exitReason: null,
        note: null,
      },
      parentId,
    );

  beforeEach(() => {
    enrollmentRepo = {
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
      findActiveByClassIdOnDate: jest.fn(),
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

    syeRepo = {
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

    // Default: parent exists and matches the target class's grade level so
    // existing happy-path / unrelated-failure-mode tests stay green. Tests
    // that want to exercise AC-19 override `findOpenByStudentAndSchoolYear`.
    syeRepo.findOpenByStudentAndSchoolYear.mockResolvedValue(
      createMockParent(),
    );
    syeRepo.findCoveringDateByStudentAndSchoolYear.mockImplementation(
      (studentId, schoolYearId) =>
        syeRepo.findOpenByStudentAndSchoolYear(studentId, schoolYearId),
    );
    enrollmentRepo.findEffectiveByStudentIdAt.mockImplementation((studentId) =>
      enrollmentRepo.findActiveByStudentId(studentId),
    );
    enrollmentRepo.findOverlappingByStudentId.mockResolvedValue(null);

    runner = {
      run: jest.fn((task) => task(stubTx)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    recorder = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;

    useCase = new TransferStudentUseCase(
      enrollmentRepo,
      classRepo,
      syeRepo,
      runner,
      recorder,
    );
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

      const result = await useCase.execute(
        {
          studentId,
          toClassId: targetClassId,
          campusId,
        },
        stubActor,
      );

      expect(result.closed.exitReason).toBe(ExitReason.TRANSFERRED);
      expect(result.closed.endDate).not.toBeNull();
      expect(result.closed.classId).toBe(sourceClassId);
      expect(result.opened.classId).toBe(targetClassId);
      expect(result.opened.endDate).toBeNull();
      expect(result.opened.exitReason).toBeNull();
      // AC-19 / AC-4: opened row carries the resolved parent.id verbatim.
      expect(result.opened.schoolYearEnrollmentId).toBe(parentId);
      expect(syeRepo.findOpenByStudentAndSchoolYear).toHaveBeenCalledWith(
        studentId,
        targetSchoolYearId,
      );
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

      const result = await useCase.execute(
        {
          studentId,
          toClassId: targetClassId,
          campusId,
          transferDate: explicit,
          note: "moved",
        },
        stubActor,
      );

      // Domain compares date-only — assert UTC date components.
      const dateOnly = (d: Date) =>
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      expect(dateOnly(result.closed.endDate!)).toBe(
        dateOnly(new Date("2025-03-14T00:00:00.000Z")),
      );
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
        useCase.execute(
          {
            studentId,
            toClassId: sourceClassId,
            campusId,
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: sourceClassId,
            campusId,
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            fromClassId: "wrong-source",
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            fromClassId: "wrong-source",
          },
          stubActor,
        ),
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

      const result = await useCase.execute(
        {
          studentId,
          toClassId: targetClassId,
          campusId,
          fromClassId: sourceClassId,
        },
        stubActor,
      );

      expect(result.opened.classId).toBe(targetClassId);
      expect(enrollmentRepo.transferEnrollment).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-18: no active enrollment", () => {
    it("throws ConflictException NO_ACTIVE_ENROLLMENT when student has no open period", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(null);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            transferDate: tooEarly,
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            transferDate: tooEarly,
          },
          stubActor,
        ),
      ).rejects.toThrow(/INVALID_TRANSFER_DATE/);

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });

    it("allows a future transfer by scheduling a non-overlapping source closure", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      enrollmentRepo.transferEnrollment.mockImplementation(
        async (closed, opened) => ({ closed, opened }),
      );
      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const result = await useCase.execute(
        {
          studentId,
          toClassId: targetClassId,
          campusId,
          transferDate: oneWeekFromNow,
        },
        stubActor,
      );

      expect(result.opened.enrollmentDate).toEqual(oneWeekFromNow);
      expect(result.closed.endDate).toEqual(
        new Date(
          Date.UTC(
            oneWeekFromNow.getUTCFullYear(),
            oneWeekFromNow.getUTCMonth(),
            oneWeekFromNow.getUTCDate() - 1,
          ),
        ),
      );
      expect(enrollmentRepo.transferEnrollment).toHaveBeenCalledTimes(1);
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
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            // 2025-08-15 is well after the active.enrollmentDate (2024-09-01)
            // and before today, so it ONLY trips the school-year bound.
            transferDate: new Date("2025-08-15T00:00:00.000Z"),
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            transferDate: new Date("2025-08-15T00:00:00.000Z"),
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            // After the (past) schoolYear ended, but still before today.
            transferDate: new Date("2024-08-15T00:00:00.000Z"),
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
          },
          stubActor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(enrollmentRepo.findActiveByStudentId).not.toHaveBeenCalled();
      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when target class does not exist", async () => {
      classRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            transferDate: new Date("2024-01-01T00:00:00.000Z"),
          },
          stubActor,
        ),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");
    });

    it("does not call transferEnrollment when any earlier validation fails", async () => {
      classRepo.findById.mockResolvedValue(buildClass(sourceClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );

      // Same-class case
      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: sourceClassId,
            campusId,
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });
  });

  describe("AC-19 / Scenario 9: parent grade-match gate", () => {
    it("throws ConflictException GRADE_LEVEL_MISMATCH when parent.gradeLevelId !== targetClass.gradeLevelId", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      // Override default: parent registered in a different grade.
      syeRepo.findOpenByStudentAndSchoolYear.mockResolvedValue(
        createMockParent({ gradeLevelId: "grade-level-OTHER" }),
      );

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
          },
          stubActor,
        ),
      ).rejects.toThrow(SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH);

      // No child rows are written or closed (Scenario 9 invariant).
      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();
    });

    it("throws (data-integrity sanity assertion) when active enrollment exists but no open parent — does NOT call transferEnrollment", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      // Active enrollment + missing parent breaks D6 — internal invariant
      // violation, not a user-facing 4xx. We assert against the bare Error
      // shape and the diagnostic message.
      syeRepo.findOpenByStudentAndSchoolYear.mockResolvedValue(null);
      const errorSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
          },
          stubActor,
        ),
      ).rejects.toThrow(/data integrity broken/i);

      expect(errorSpy).toHaveBeenCalled();
      expect(enrollmentRepo.transferEnrollment).not.toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it("resolves parent against the *target* class's schoolYearId (D3)", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      enrollmentRepo.transferEnrollment.mockImplementation(
        async (closed, opened) => ({ closed, opened }),
      );

      await useCase.execute(
        {
          studentId,
          toClassId: targetClassId,
          campusId,
        },
        stubActor,
      );

      expect(syeRepo.findOpenByStudentAndSchoolYear).toHaveBeenCalledWith(
        studentId,
        targetSchoolYearId,
      );
    });
  });

  describe("overlap persistence races", () => {
    it("returns a stable conflict with nullable conflictingEnrollment when the database wins the race", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      enrollmentRepo.transferEnrollment.mockRejectedValue({
        code: "P2002",
        message: "Unique constraint failed",
        meta: {
          modelName: "Enrollment",
          target: "idx_enrollment_unique_uncancelled_start",
        },
      });

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
            transferDate: new Date("2026-05-18T00:00:00.000Z"),
          },
          stubActor,
        ),
      ).rejects.toMatchObject({
        response: {
          code: "ENROLLMENT_PERIOD_OVERLAP",
          message: "ENROLLMENT_PERIOD_OVERLAP",
          conflictingEnrollment: null,
        },
      });
      expect(recorder.record).not.toHaveBeenCalled();
    });
  });

  describe("audit-log emission (admin-audit-log Scenario 1 / AC-3 / AC-7)", () => {
    it("emits TRANSFER_STUDENT audit row with the Scenario 1 context shape inside the same tx", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment({ classId: sourceClassId }),
      );
      enrollmentRepo.transferEnrollment.mockImplementation(
        async (closed, opened) => ({ closed, opened }),
      );
      const explicit = new Date("2026-05-18T00:00:00.000Z");

      await useCase.execute(
        {
          studentId,
          toClassId: targetClassId,
          campusId,
          transferDate: explicit,
        },
        stubActor,
      );

      expect(recorder.record).toHaveBeenCalledTimes(1);
      const [auditInput, txArg] = recorder.record.mock.calls[0];
      expect(auditInput).toMatchObject({
        actorId: stubActor.id,
        action: "TRANSFER_STUDENT",
        targetType: "student",
        targetId: studentId,
        campusId,
      });
      expect(auditInput.context).toMatchObject({
        actorName: "Alice Nguyen",
        fromClassId: sourceClassId,
        // active.class is not eager-loaded by buildActiveEnrollment, so null
        // is the contract here — recorder fills targetName from the snapshot;
        // callers without an eager-loaded source class get null here.
        fromClassName: null,
        toClassId: targetClassId,
        toClassName: `Test Class ${targetClassId}`,
        transferDate: explicit.toISOString(),
      });
      // Same tx instance — both writes participate in one UoW.
      expect(txArg).toBe(stubTx);
      // transferEnrollment was called with the tx as the third arg.
      expect(enrollmentRepo.transferEnrollment).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        stubTx,
      );
    });
  });

  describe("rollback on recorder failure (admin-audit-log AC-4 / Scenario 2)", () => {
    it("propagates the recorder error so the outer tx rolls back the transfer", async () => {
      classRepo.findById.mockResolvedValue(buildClass(targetClassId));
      enrollmentRepo.findActiveByStudentId.mockResolvedValue(
        buildActiveEnrollment(),
      );
      enrollmentRepo.transferEnrollment.mockImplementation(
        async (closed, opened) => ({ closed, opened }),
      );
      const auditFailure = new Error("audit failure");
      recorder.record.mockRejectedValue(auditFailure);

      await expect(
        useCase.execute(
          {
            studentId,
            toClassId: targetClassId,
            campusId,
          },
          stubActor,
        ),
      ).rejects.toBe(auditFailure);

      // transferEnrollment WAS called — inside the tx that ultimately threw.
      // A real Prisma tx would roll back both row writes when the audit error
      // bubbles out of `runner.run`.
      expect(enrollmentRepo.transferEnrollment).toHaveBeenCalledTimes(1);
    });
  });
});
