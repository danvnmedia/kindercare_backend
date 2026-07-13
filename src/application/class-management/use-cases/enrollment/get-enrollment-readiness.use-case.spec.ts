import { BadRequestException, NotFoundException } from "@nestjs/common";

import { GetEnrollmentReadinessUseCase } from "./get-enrollment-readiness.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import {
  EnrollmentReadinessMode,
  EnrollmentReadinessState,
} from "../../enrollment-readiness.types";
import { EnrollmentErrorCode } from "../../enrollment-error-codes";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

describe("GetEnrollmentReadinessUseCase", () => {
  let useCase: GetEnrollmentReadinessUseCase;
  let enrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let classRepository: jest.Mocked<ClassRepository>;
  let studentRepository: jest.Mocked<StudentRepository>;
  let syeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";
  const studentId = "student-1";
  const schoolYearId = "school-year-1";
  const gradeLevelId = "grade-1";
  const effectiveDate = new Date("2026-09-10T00:00:00.000Z");

  const createGradeLevel = (id = gradeLevelId) =>
    GradeLevel.create(
      { campusId, name: id === gradeLevelId ? "Grade 1" : "Grade 2", order: 1 },
      id,
    );

  const createSchoolYear = (
    range = {
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-06-30T00:00:00.000Z"),
    },
  ) =>
    SchoolYear.create(
      {
        campusId,
        name: "2026-2027",
        startDate: range.startDate,
        endDate: range.endDate,
      },
      schoolYearId,
    );

  const createClass = (
    overrides: { campusId?: string; gradeLevelId?: string } = {},
  ) =>
    Class.create(
      {
        campusId: overrides.campusId ?? campusId,
        name: "Class A",
        description: null,
        schoolYearId,
        gradeLevelId: overrides.gradeLevelId ?? gradeLevelId,
        gradeLevel: createGradeLevel(overrides.gradeLevelId ?? gradeLevelId),
        schoolYear: createSchoolYear(),
      },
      classId,
    );

  const createStudent = (id = studentId, ownerCampusId = campusId) =>
    Student.create(
      {
        campusId: ownerCampusId,
        studentCode: `STU-${id}`,
        fullName: `Student ${id}`,
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      },
      id,
    );

  const createParent = (
    overrides: {
      id?: string;
      gradeLevelId?: string;
      exitDate?: Date | null;
      exitReason?: ExitReason | null;
    } = {},
  ) =>
    SchoolYearEnrollment.create(
      {
        studentId,
        campusId,
        schoolYearId,
        gradeLevelId: overrides.gradeLevelId ?? gradeLevelId,
        gradeLevel: createGradeLevel(overrides.gradeLevelId ?? gradeLevelId),
        schoolYear: createSchoolYear(),
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
        exitDate: overrides.exitDate ?? null,
        exitReason: overrides.exitReason ?? null,
        note: null,
      },
      overrides.id ?? "sye-1",
    );

  const createActiveEnrollment = (
    overrides: { id?: string; enrollmentDate?: Date; classId?: string } = {},
  ) =>
    Enrollment.create(
      {
        classId: overrides.classId ?? "source-class",
        studentId,
        schoolYearEnrollmentId: "sye-1",
        enrollmentDate:
          overrides.enrollmentDate ?? new Date("2026-09-01T00:00:00.000Z"),
        note: null,
        class: Class.create(
          {
            campusId,
            name: "Source Class",
            description: null,
            schoolYearId,
            gradeLevelId,
          },
          overrides.classId ?? "source-class",
        ),
      },
      overrides.id ?? "active-1",
    );

  beforeEach(() => {
    enrollmentRepository = {
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

    classRepository = {
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

    studentRepository = {
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

    syeRepository = {
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

    useCase = new GetEnrollmentReadinessUseCase(
      enrollmentRepository,
      classRepository,
      studentRepository,
      syeRepository,
    );

    classRepository.findById.mockResolvedValue(createClass());
    studentRepository.findById.mockResolvedValue(createStudent());
    enrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
    enrollmentRepository.findEffectiveByStudentIdAt.mockImplementation(
      (studentId) => enrollmentRepository.findActiveByStudentId(studentId),
    );
    enrollmentRepository.findOverlappingByStudentId.mockImplementation(
      (studentId, _startDate, _endDate, excludeEnrollmentId) =>
        excludeEnrollmentId
          ? Promise.resolve(null)
          : enrollmentRepository.findActiveByStudentId(studentId),
    );
    enrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
    syeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(
      createParent(),
    );
    syeRepository.findCoveringDateByStudentAndSchoolYear.mockImplementation(
      (studentId, schoolYearId) =>
        syeRepository.findOpenByStudentAndSchoolYear(studentId, schoolYearId),
    );
  });

  it("returns READY rows without performing writes", async () => {
    const rows = await useCase.execute({
      campusId,
      classId,
      mode: EnrollmentReadinessMode.ENROLL,
      effectiveDate,
      students: [{ studentId }],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        studentId,
        state: EnrollmentReadinessState.READY,
        context: expect.objectContaining({
          requestedDate: effectiveDate,
          targetClass: { id: classId, name: "Class A" },
          schoolYearEnrollment: expect.objectContaining({ id: "sye-1" }),
        }),
      }),
    ]);
    expect(enrollmentRepository.save).not.toHaveBeenCalled();
    expect(enrollmentRepository.saveMany).not.toHaveBeenCalled();
    expect(enrollmentRepository.update).not.toHaveBeenCalled();
    expect(enrollmentRepository.transferEnrollment).not.toHaveBeenCalled();
  });

  it("preserves the effective source and reports a distinct conflicting enrollment", async () => {
    const source = createActiveEnrollment({
      id: "source-enrollment",
      classId: "source-class",
    });
    const conflicting = createActiveEnrollment({
      id: "conflicting-enrollment",
      classId: "future-class",
    });
    enrollmentRepository.findEffectiveByStudentIdAt.mockResolvedValue(source);
    enrollmentRepository.findOverlappingByStudentId.mockResolvedValue(
      conflicting,
    );

    const rows = await useCase.execute({
      campusId,
      classId,
      mode: EnrollmentReadinessMode.TRANSFER,
      effectiveDate,
      students: [{ studentId }],
    });

    expect(rows[0]).toMatchObject({
      state: EnrollmentReadinessState.BLOCKED,
      reason: "ENROLLMENT_PERIOD_OVERLAP",
      context: {
        activeEnrollment: {
          id: "source-enrollment",
          classId: "source-class",
        },
        conflictingEnrollment: {
          id: "conflicting-enrollment",
          classId: "future-class",
        },
      },
    });
    expect(enrollmentRepository.save).not.toHaveBeenCalled();
    expect(enrollmentRepository.update).not.toHaveBeenCalled();
    expect(enrollmentRepository.transferEnrollment).not.toHaveBeenCalled();
  });

  it("returns row-level date-bound failures before student lookup", async () => {
    classRepository.findById.mockResolvedValue(
      Class.create(
        {
          campusId,
          name: "Class A",
          description: null,
          schoolYearId,
          gradeLevelId,
          schoolYear: createSchoolYear({
            startDate: new Date("2026-09-01T00:00:00.000Z"),
            endDate: new Date("2027-06-30T00:00:00.000Z"),
          }),
        },
        classId,
      ),
    );

    const rows = await useCase.execute({
      campusId,
      classId,
      mode: EnrollmentReadinessMode.ENROLL,
      effectiveDate: new Date("2027-07-01T00:00:00.000Z"),
      students: [{ studentId }],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        state: EnrollmentReadinessState.BLOCKED,
        reason: "ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR",
      }),
    ]);
    expect(studentRepository.findById).not.toHaveBeenCalled();
  });

  it("returns NO_SCHOOL_YEAR_ENROLLMENT when no parent exists", async () => {
    syeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(null);
    syeRepository.findLatestByStudentAndSchoolYear.mockResolvedValue(null);

    const rows = await useCase.execute({
      campusId,
      classId,
      mode: EnrollmentReadinessMode.ENROLL,
      effectiveDate,
      students: [{ studentId }],
    });

    expect(rows[0]).toMatchObject({
      state: EnrollmentReadinessState.BLOCKED,
      reason: SchoolYearEnrollmentErrorCode.NO_SCHOOL_YEAR_ENROLLMENT,
    });
  });

  it("returns PARENT_ALREADY_CLOSED when the latest parent is closed", async () => {
    syeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(null);
    syeRepository.findLatestByStudentAndSchoolYear.mockResolvedValue(
      createParent({
        exitDate: new Date("2026-09-09T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
      }),
    );

    const rows = await useCase.execute({
      campusId,
      classId,
      mode: EnrollmentReadinessMode.ENROLL,
      effectiveDate,
      students: [{ studentId }],
    });

    expect(rows[0]).toMatchObject({
      state: EnrollmentReadinessState.BLOCKED,
      reason: SchoolYearEnrollmentErrorCode.PARENT_ALREADY_CLOSED,
      context: {
        schoolYearEnrollment: expect.objectContaining({
          exitReason: ExitReason.WITHDRAWN,
        }),
      },
    });
  });

  it("returns GRADE_LEVEL_MISMATCH with parent and target context", async () => {
    syeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(
      createParent({ gradeLevelId: "grade-2" }),
    );

    const rows = await useCase.execute({
      campusId,
      classId,
      mode: EnrollmentReadinessMode.ENROLL,
      effectiveDate,
      students: [{ studentId }],
    });

    expect(rows[0]).toMatchObject({
      state: EnrollmentReadinessState.BLOCKED,
      reason: SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH,
      context: {
        targetGradeLevel: expect.objectContaining({ id: gradeLevelId }),
        schoolYearEnrollment: expect.objectContaining({
          gradeLevelId: "grade-2",
        }),
      },
    });
  });

  it("returns INVALID_TRANSFER_DATE for transfer dates before active enrollment", async () => {
    enrollmentRepository.findActiveByStudentId.mockResolvedValue(
      createActiveEnrollment({
        enrollmentDate: new Date("2026-09-15T00:00:00.000Z"),
      }),
    );

    const rows = await useCase.execute({
      campusId,
      classId,
      mode: EnrollmentReadinessMode.TRANSFER,
      effectiveDate,
      students: [{ studentId }],
    });

    expect(rows[0]).toMatchObject({
      state: EnrollmentReadinessState.BLOCKED,
      reason: "INVALID_TRANSFER_DATE",
    });
  });

  it("hides missing and cross-campus target classes with the same 404 body", async () => {
    classRepository.findById.mockResolvedValue(
      createClass({ campusId: otherCampusId }),
    );

    await expect(
      useCase.execute({
        campusId,
        classId,
        mode: EnrollmentReadinessMode.ENROLL,
        effectiveDate,
        students: [{ studentId }],
      }),
    ).rejects.toThrow(
      new NotFoundException(`Class with ID ${classId} not found`),
    );

    expect(studentRepository.findById).not.toHaveBeenCalled();
  });

  it("rejects empty readiness batches with BATCH_EMPTY", async () => {
    await expect(
      useCase.execute({
        campusId,
        classId,
        mode: EnrollmentReadinessMode.ENROLL,
        effectiveDate,
        students: [],
      }),
    ).rejects.toThrow(new BadRequestException(EnrollmentErrorCode.BATCH_EMPTY));
  });
});
