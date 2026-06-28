import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BulkEnrollStudentsUseCase } from "./bulk-enroll-students.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { User } from "@/domain/user-management/user.entity";

const stubActor = User.create({ clerkUid: "user_audit12345" });

describe("BulkEnrollStudentsUseCase", () => {
  let useCase: BulkEnrollStudentsUseCase;
  let mockEnrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockStudentRepository: jest.Mocked<StudentRepository>;
  let mockSyeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";
  const schoolYearId = "school-year-1";
  const classGradeLevelId = "grade-1";
  const enrollmentDate = new Date("2025-09-01T00:00:00.000Z");

  // Helper: per-row parent matching the class's schoolYearId. Caller picks the
  // grade (default matches the class — override for mismatch tests).
  const createMockParent = (
    studentId: string,
    overrides: { gradeLevelId?: string } = {},
  ): SchoolYearEnrollment =>
    SchoolYearEnrollment.create(
      {
        studentId,
        campusId,
        schoolYearId,
        gradeLevelId: overrides.gradeLevelId ?? classGradeLevelId,
        enrollmentDate: new Date("2025-08-01T00:00:00.000Z"),
        exitDate: null,
        exitReason: null,
        note: null,
      },
      `sye-${studentId}`,
    );

  // Default school year range is wide so happy-path tests pass. Date-bounds
  // tests pass an explicit narrow range.
  const createMockClass = (
    overrides: {
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
        name: "Lớp A1",
        campusId: ownerCampusId,
        gradeLevelId: "grade-1",
        schoolYearId: "school-year-1",
        description: null,
        schoolYear,
      },
      classId,
    );
  };

  const createMockStudent = (
    studentId: string,
    overrides: { campusId?: string } = {},
  ): Student =>
    Student.create(
      {
        campusId: overrides.campusId ?? campusId,
        studentCode: `CODE-${studentId}`,
        fullName: `Student ${studentId}`,
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      },
      studentId,
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

    mockStudentRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailInCampus: jest.fn(),
      findByPhoneNumber: jest.fn(),
      findByPhoneNumberInCampus: jest.fn(),
      findByStudentCodeInCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      findEligibleForClass: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      assignGuardians: jest.fn(),
      removeGuardians: jest.fn(),
      updateGuardianRelationship: jest.fn(),
      getStudentGuardians: jest.fn(),
    } as jest.Mocked<StudentRepository>;

    mockSyeRepository = {
      findById: jest.fn(),
      findOpenByStudentAndSchoolYear: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAllByStudentIdWithChildCount: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      withdrawWithChildren: jest.fn(),
    } as jest.Mocked<SchoolYearEnrollmentRepository>;

    useCase = new BulkEnrollStudentsUseCase(
      mockEnrollmentRepository,
      mockClassRepository,
      mockStudentRepository,
      mockSyeRepository,
    );

    // Default: no active enrollment, no composite-key collision.
    mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
    mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
    // Default: saveMany echoes input as if persisted (preserving order).
    mockEnrollmentRepository.saveMany.mockImplementation(
      async (entities) => entities,
    );
    // Default: every student has a matching-grade open parent. Per-row tests
    // override for AC-18 (NO_SCHOOL_YEAR_ENROLLMENT / GRADE_LEVEL_MISMATCH).
    mockSyeRepository.findOpenByStudentAndSchoolYear.mockImplementation(
      async (sId) => createMockParent(sId),
    );
  });

  // -------- Whole-call validation (FR-3) — short-circuits before any row work --------

  describe("whole-call validation", () => {
    it("throws BATCH_EMPTY when students is empty (AC-6)", async () => {
      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            enrollmentDate,
            students: [],
          },
          stubActor,
        ),
      ).rejects.toThrow(new BadRequestException("BATCH_EMPTY"));

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
      expect(mockEnrollmentRepository.saveMany).not.toHaveBeenCalled();
    });

    it("throws BATCH_TOO_LARGE when students exceeds 100 (AC-6)", async () => {
      const students = Array.from({ length: 101 }, (_, i) => ({
        studentId: `s-${i}`,
      }));

      await expect(
        useCase.execute(
          { campusId, classId, enrollmentDate, students },
          stubActor,
        ),
      ).rejects.toThrow(new BadRequestException("BATCH_TOO_LARGE"));

      expect(mockClassRepository.findById).not.toHaveBeenCalled();
      expect(mockEnrollmentRepository.saveMany).not.toHaveBeenCalled();
    });

    it("throws DUPLICATE_STUDENT_IN_BATCH when payload contains the same studentId twice (AC-6)", async () => {
      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            enrollmentDate,
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
      expect(mockEnrollmentRepository.saveMany).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when class does not exist (AC-4)", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            enrollmentDate,
            students: [{ studentId: "s-1" }],
          },
          stubActor,
        ),
      ).rejects.toThrow(
        new NotFoundException(`Class with ID ${classId} not found`),
      );

      expect(mockEnrollmentRepository.saveMany).not.toHaveBeenCalled();
    });

    it("throws NotFoundException with the SAME body when class belongs to a different campus (AC-4, D5)", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass({ campusId: otherCampusId }),
      );

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            enrollmentDate,
            students: [{ studentId: "s-1" }],
          },
          stubActor,
        ),
      ).rejects.toThrow(
        new NotFoundException(`Class with ID ${classId} not found`),
      );

      // Critically — student lookups never run (whole-call abort).
      expect(mockStudentRepository.findById).not.toHaveBeenCalled();
      expect(mockEnrollmentRepository.saveMany).not.toHaveBeenCalled();
    });

    it("throws ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR when enrollmentDate is outside the schoolYear range (AC-5)", async () => {
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
            classId,
            enrollmentDate: new Date("2026-07-15T00:00:00.000Z"),
            students: [{ studentId: "s-1" }],
          },
          stubActor,
        ),
      ).rejects.toThrow(
        new BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR"),
      );

      expect(mockEnrollmentRepository.saveMany).not.toHaveBeenCalled();
    });
  });

  // -------- Per-row validation (FR-4) — tolerant; survivors persist --------

  describe("per-row validation and persistence", () => {
    it("persists 5 valid students and returns enrolled.length=5, skipped.length=0 (AC-1)", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      const students = ["s-1", "s-2", "s-3", "s-4", "s-5"];
      mockStudentRepository.findById.mockImplementation(async (id) =>
        createMockStudent(id),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          students: students.map((studentId) => ({ studentId })),
        },
        stubActor,
      );

      expect(result.enrolled).toHaveLength(5);
      expect(result.skipped).toHaveLength(0);
      expect(mockEnrollmentRepository.saveMany).toHaveBeenCalledTimes(1);
      const passedToSaveMany = mockEnrollmentRepository.saveMany.mock
        .calls[0][0] as Enrollment[];
      expect(passedToSaveMany.map((e) => e.studentId)).toEqual(students);
      expect(
        passedToSaveMany.every(
          (e) =>
            e.classId === classId &&
            e.enrollmentDate.getTime() === enrollmentDate.getTime() &&
            e.endDate === null,
        ),
      ).toBe(true);
      // AC-5: parent FK is threaded onto every persisted child row.
      expect(passedToSaveMany.map((e) => e.schoolYearEnrollmentId)).toEqual(
        students.map((sId) => `sye-${sId}`),
      );
    });

    it("mixed batch: 3 valid + 1 already-enrolled + 1 cross-campus → enrolled=3, skipped=2 (AC-2)", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      const ids = ["s-ok-1", "s-ok-2", "s-ok-3", "s-active", "s-other-campus"];
      mockStudentRepository.findById.mockImplementation(async (id) => {
        if (id === "s-other-campus") {
          return createMockStudent(id, { campusId: otherCampusId });
        }
        return createMockStudent(id);
      });
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) =>
          id === "s-active"
            ? Enrollment.create(
                {
                  classId: "another-class",
                  studentId: id,
                  schoolYearEnrollmentId: "sye-other",
                  enrollmentDate: new Date("2025-08-01T00:00:00.000Z"),
                  note: null,
                },
                "active-1",
              )
            : null,
      );

      const result = await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          students: ids.map((studentId) => ({ studentId })),
        },
        stubActor,
      );

      expect(result.enrolled).toHaveLength(3);
      expect(result.skipped).toHaveLength(2);
      // Order matches input order for skipped reasons.
      expect(result.skipped).toEqual(
        expect.arrayContaining([
          { studentId: "s-active", reason: "STUDENT_ALREADY_ENROLLED" },
          { studentId: "s-other-campus", reason: "STUDENT_NOT_IN_CAMPUS" },
        ]),
      );
      const passedToSaveMany = mockEnrollmentRepository.saveMany.mock
        .calls[0][0] as Enrollment[];
      expect(passedToSaveMany.map((e) => e.studentId)).toEqual([
        "s-ok-1",
        "s-ok-2",
        "s-ok-3",
      ]);
    });

    it("all-skipped batch never calls saveMany (AC-3)", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      const ids = ["s-1", "s-2", "s-3", "s-4", "s-5"];
      mockStudentRepository.findById.mockImplementation(async (id) =>
        createMockStudent(id),
      );
      // Every student already has an active enrollment elsewhere.
      mockEnrollmentRepository.findActiveByStudentId.mockImplementation(
        async (id) =>
          Enrollment.create(
            {
              classId: "another-class",
              studentId: id,
              schoolYearEnrollmentId: "sye-other",
              enrollmentDate: new Date("2025-08-01T00:00:00.000Z"),
              note: null,
            },
            `active-${id}`,
          ),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          students: ids.map((studentId) => ({ studentId })),
        },
        stubActor,
      );

      expect(result.enrolled).toHaveLength(0);
      expect(result.skipped).toHaveLength(5);
      expect(
        result.skipped.every((s) => s.reason === "STUDENT_ALREADY_ENROLLED"),
      ).toBe(true);
      expect(mockEnrollmentRepository.saveMany).not.toHaveBeenCalled();
    });

    it("skips with STUDENT_NOT_FOUND when the student does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockImplementation(async (id) =>
        id === "ghost" ? null : createMockStudent(id),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          students: [{ studentId: "ghost" }, { studentId: "s-2" }],
        },
        stubActor,
      );

      expect(result.enrolled).toHaveLength(1);
      expect(result.skipped).toEqual([
        { studentId: "ghost", reason: "STUDENT_NOT_FOUND" },
      ]);
    });

    it("skips with ENROLLMENT_ALREADY_EXISTS_ON_DATE when composite-key check hits", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockImplementation(async (id) =>
        createMockStudent(id),
      );
      mockEnrollmentRepository.findByStudentClassDate.mockImplementation(
        async (sId) =>
          sId === "s-dup"
            ? Enrollment.create(
                {
                  classId,
                  studentId: sId,
                  schoolYearEnrollmentId: "sye-test",
                  enrollmentDate,
                  note: null,
                },
                "existing-1",
              )
            : null,
      );

      const result = await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          students: [{ studentId: "s-1" }, { studentId: "s-dup" }],
        },
        stubActor,
      );

      expect(result.enrolled).toHaveLength(1);
      expect(result.skipped).toEqual([
        { studentId: "s-dup", reason: "ENROLLMENT_ALREADY_EXISTS_ON_DATE" },
      ]);
    });
  });

  // -------- Per-row note override (FR-2) --------

  describe("note resolution (FR-2)", () => {
    it("per-row note overrides batch note; omitted per-row inherits batch note (AC-7)", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockImplementation(async (id) =>
        createMockStudent(id),
      );

      await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          note: "Term 2 cohort",
          students: [
            { studentId: "s-row-note", note: "Late join" },
            { studentId: "s-inherits" },
          ],
        },
        stubActor,
      );

      const passedToSaveMany = mockEnrollmentRepository.saveMany.mock
        .calls[0][0] as Enrollment[];
      expect(passedToSaveMany).toHaveLength(2);
      const byId = new Map(passedToSaveMany.map((e) => [e.studentId, e]));
      expect(byId.get("s-row-note")!.note).toBe("Late join");
      expect(byId.get("s-inherits")!.note).toBe("Term 2 cohort");
    });

    it("falls back to null when neither batch nor per-row note is set", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockImplementation(async (id) =>
        createMockStudent(id),
      );

      await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          students: [{ studentId: "s-1" }],
        },
        stubActor,
      );

      const passedToSaveMany = mockEnrollmentRepository.saveMany.mock
        .calls[0][0] as Enrollment[];
      expect(passedToSaveMany[0].note).toBeNull();
    });
  });

  // -------- AC-18: parent-enrollment gate per row (tolerant) --------

  describe("parent-enrollment gate per row (AC-18 / Scenarios 2-3)", () => {
    it("skips with NO_SCHOOL_YEAR_ENROLLMENT when the open parent is missing; other rows still enroll", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockImplementation(async (id) =>
        createMockStudent(id),
      );
      // s-no-parent has no open parent in the class's school year.
      mockSyeRepository.findOpenByStudentAndSchoolYear.mockImplementation(
        async (sId) => (sId === "s-no-parent" ? null : createMockParent(sId)),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          students: [
            { studentId: "s-ok-1" },
            { studentId: "s-no-parent" },
            { studentId: "s-ok-2" },
          ],
        },
        stubActor,
      );

      expect(result.enrolled).toHaveLength(2);
      expect(result.skipped).toEqual([
        {
          studentId: "s-no-parent",
          reason: SchoolYearEnrollmentErrorCode.NO_SCHOOL_YEAR_ENROLLMENT,
        },
      ]);
      const passedToSaveMany = mockEnrollmentRepository.saveMany.mock
        .calls[0][0] as Enrollment[];
      expect(passedToSaveMany.map((e) => e.studentId)).toEqual([
        "s-ok-1",
        "s-ok-2",
      ]);
      expect(passedToSaveMany.map((e) => e.schoolYearEnrollmentId)).toEqual([
        "sye-s-ok-1",
        "sye-s-ok-2",
      ]);
    });

    it("skips with GRADE_LEVEL_MISMATCH when the open parent's grade differs; other rows still enroll", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockImplementation(async (id) =>
        createMockStudent(id),
      );
      // s-wrong-grade has an open parent but for a different grade level.
      mockSyeRepository.findOpenByStudentAndSchoolYear.mockImplementation(
        async (sId) =>
          sId === "s-wrong-grade"
            ? createMockParent(sId, { gradeLevelId: "grade-OTHER" })
            : createMockParent(sId),
      );

      const result = await useCase.execute(
        {
          campusId,
          classId,
          enrollmentDate,
          students: [
            { studentId: "s-ok-1" },
            { studentId: "s-wrong-grade" },
            { studentId: "s-ok-2" },
          ],
        },
        stubActor,
      );

      expect(result.enrolled).toHaveLength(2);
      expect(result.skipped).toEqual([
        {
          studentId: "s-wrong-grade",
          reason: SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH,
        },
      ]);
      const passedToSaveMany = mockEnrollmentRepository.saveMany.mock
        .calls[0][0] as Enrollment[];
      expect(passedToSaveMany.map((e) => e.studentId)).toEqual([
        "s-ok-1",
        "s-ok-2",
      ]);
    });
  });

  // -------- AC-8: race-condition rollback (documented behavior) --------

  describe("race-condition rollback (AC-8)", () => {
    it("propagates a saveMany rejection unchanged (whole batch rolled back by saveMany's transaction)", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockImplementation(async (id) =>
        createMockStudent(id),
      );
      mockEnrollmentRepository.saveMany.mockRejectedValue(
        new Error("Unique constraint failed"),
      );

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            enrollmentDate,
            students: [{ studentId: "s-1" }, { studentId: "s-2" }],
          },
          stubActor,
        ),
      ).rejects.toThrow("Unique constraint failed");

      // Use case must not swallow the error or return a partial result.
      expect(mockEnrollmentRepository.saveMany).toHaveBeenCalledTimes(1);
    });
  });
});
