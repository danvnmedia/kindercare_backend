import { NotFoundException } from "@nestjs/common";
import { GetStudentSchoolYearHistoryUseCase } from "./get-student-school-year-history.use-case";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

describe("GetStudentSchoolYearHistoryUseCase", () => {
  let useCase: GetStudentSchoolYearHistoryUseCase;
  let mockSyeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;
  let mockStudentRepository: jest.Mocked<StudentRepository>;

  const campusId = "campus-1";
  const differentCampusId = "campus-2";
  const studentId = "student-1";

  const createMockStudent = (overrides: { campusId?: string } = {}): Student =>
    Student.create(
      {
        campusId: overrides.campusId ?? campusId,
        studentCode: "STU001",
        fullName: "Nguyễn Văn A",
        email: "stu1@test.com",
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      },
      studentId,
    );

  const createMockSchoolYear = (
    overrides: { id?: string; name?: string } = {},
  ): SchoolYear =>
    SchoolYear.create(
      {
        campusId,
        name: overrides.name ?? "SY 2025-2026",
        startDate: new Date("2025-08-01T00:00:00.000Z"),
        endDate: new Date("2026-07-31T00:00:00.000Z"),
      },
      overrides.id ?? "sy-2025-2026",
    );

  const createMockGradeLevel = (
    overrides: { id?: string; name?: string; order?: number } = {},
  ): GradeLevel =>
    GradeLevel.create(
      {
        campusId,
        name: overrides.name ?? "Lớp Mầm",
        order: overrides.order ?? 1,
      },
      overrides.id ?? "grade-mam",
    );

  const createMockParent = (overrides: {
    id?: string;
    schoolYearId?: string;
    gradeLevelId?: string;
    enrollmentDate?: Date;
    exitDate?: Date | null;
    exitReason?: ExitReason | null;
    schoolYear?: SchoolYear;
    gradeLevel?: GradeLevel;
  }): SchoolYearEnrollment =>
    SchoolYearEnrollment.create(
      {
        studentId,
        campusId,
        schoolYearId: overrides.schoolYearId ?? "sy-2025-2026",
        gradeLevelId: overrides.gradeLevelId ?? "grade-mam",
        enrollmentDate:
          overrides.enrollmentDate ?? new Date("2025-09-01T00:00:00.000Z"),
        exitDate: overrides.exitDate ?? null,
        exitReason: overrides.exitReason ?? null,
        note: null,
        schoolYear: overrides.schoolYear,
        gradeLevel: overrides.gradeLevel,
      },
      overrides.id ?? "sye-1",
    );

  beforeEach(() => {
    mockSyeRepository = {
      findById: jest.fn(),
      findOpenByStudentAndSchoolYear: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAllByStudentIdWithChildCount: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      withdrawWithChildren: jest.fn(),
    } as jest.Mocked<SchoolYearEnrollmentRepository>;

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

    useCase = new GetStudentSchoolYearHistoryUseCase(
      mockSyeRepository,
      mockStudentRepository,
    );
  });

  it("returns a flat view per row ordered as the repository returns (DESC by date)", async () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());

    const sy2025 = createMockSchoolYear({
      id: "sy-2025-2026",
      name: "SY 2025-2026",
    });
    const sy2024 = createMockSchoolYear({
      id: "sy-2024-2025",
      name: "SY 2024-2025",
    });
    const gradeMam = createMockGradeLevel({
      id: "grade-mam",
      name: "Lớp Mầm",
      order: 1,
    });
    const gradeNha = createMockGradeLevel({
      id: "grade-nha",
      name: "Lớp Nhà Trẻ",
      order: 0,
    });

    // Repository returns DESC order: 2025 row first, 2024 row second.
    mockSyeRepository.findAllByStudentIdWithChildCount.mockResolvedValue([
      {
        enrollment: createMockParent({
          id: "sye-2025",
          schoolYearId: "sy-2025-2026",
          gradeLevelId: "grade-mam",
          enrollmentDate: new Date("2025-09-01T00:00:00.000Z"),
          schoolYear: sy2025,
          gradeLevel: gradeMam,
        }),
        childEnrollmentCount: 2,
      },
      {
        enrollment: createMockParent({
          id: "sye-2024",
          schoolYearId: "sy-2024-2025",
          gradeLevelId: "grade-nha",
          enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
          exitDate: new Date("2025-06-30T00:00:00.000Z"),
          exitReason: ExitReason.COMPLETED,
          schoolYear: sy2024,
          gradeLevel: gradeNha,
        }),
        childEnrollmentCount: 1,
      },
    ]);

    const result = await useCase.execute({ studentId, campusId });

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("sye-2025");
    expect(result[1].id).toBe("sye-2024");

    // Row 0: open parent in current year, 2 children.
    expect(result[0].schoolYearId).toBe("sy-2025-2026");
    expect(result[0].gradeLevelId).toBe("grade-mam");
    expect(result[0].exitDate).toBeNull();
    expect(result[0].exitReason).toBeNull();
    expect(result[0].schoolYear).toEqual({
      id: "sy-2025-2026",
      name: "SY 2025-2026",
      startDate: new Date("2025-08-01T00:00:00.000Z"),
      endDate: new Date("2026-07-31T00:00:00.000Z"),
    });
    expect(result[0].gradeLevel).toEqual({
      id: "grade-mam",
      name: "Lớp Mầm",
      order: 1,
    });
    expect(result[0].childEnrollmentCount).toBe(2);

    // Row 1: closed parent (COMPLETED) in prior year, 1 child.
    expect(result[1].schoolYearId).toBe("sy-2024-2025");
    expect(result[1].gradeLevelId).toBe("grade-nha");
    expect(result[1].exitReason).toBe(ExitReason.COMPLETED);
    expect(result[1].schoolYear?.name).toBe("SY 2024-2025");
    expect(result[1].gradeLevel?.name).toBe("Lớp Nhà Trẻ");
    expect(result[1].childEnrollmentCount).toBe(1);

    expect(
      mockSyeRepository.findAllByStudentIdWithChildCount,
    ).toHaveBeenCalledWith(studentId);
  });

  it("returns an empty array when the student has no history", async () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());
    mockSyeRepository.findAllByStudentIdWithChildCount.mockResolvedValue([]);

    const result = await useCase.execute({ studentId, campusId });

    expect(result).toEqual([]);
    expect(
      mockSyeRepository.findAllByStudentIdWithChildCount,
    ).toHaveBeenCalledWith(studentId);
  });

  it("throws 404 when the student does not exist", async () => {
    mockStudentRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ studentId, campusId })).rejects.toThrow(
      NotFoundException,
    );

    expect(
      mockSyeRepository.findAllByStudentIdWithChildCount,
    ).not.toHaveBeenCalled();
  });

  it("throws 404 when the student belongs to a different campus (cross-campus hidden)", async () => {
    mockStudentRepository.findById.mockResolvedValue(
      createMockStudent({ campusId: differentCampusId }),
    );

    await expect(useCase.execute({ studentId, campusId })).rejects.toThrow(
      NotFoundException,
    );

    expect(
      mockSyeRepository.findAllByStudentIdWithChildCount,
    ).not.toHaveBeenCalled();
  });

  it("maps childEnrollmentCount=0 verbatim onto rows with no child class enrollments", async () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());

    mockSyeRepository.findAllByStudentIdWithChildCount.mockResolvedValue([
      {
        enrollment: createMockParent({
          id: "sye-no-children",
          schoolYear: createMockSchoolYear(),
          gradeLevel: createMockGradeLevel(),
        }),
        childEnrollmentCount: 0,
      },
    ]);

    const result = await useCase.execute({ studentId, campusId });

    expect(result).toHaveLength(1);
    expect(result[0].childEnrollmentCount).toBe(0);
  });

  it("emits null relations when the entity has no eager-loaded schoolYear/gradeLevel", async () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());

    mockSyeRepository.findAllByStudentIdWithChildCount.mockResolvedValue([
      {
        enrollment: createMockParent({ id: "sye-no-relations" }),
        childEnrollmentCount: 3,
      },
    ]);

    const result = await useCase.execute({ studentId, campusId });

    expect(result[0].schoolYear).toBeNull();
    expect(result[0].gradeLevel).toBeNull();
    expect(result[0].childEnrollmentCount).toBe(3);
  });
});
