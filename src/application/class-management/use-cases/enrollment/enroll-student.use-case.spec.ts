import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { EnrollStudentUseCase } from "./enroll-student.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";

describe("EnrollStudentUseCase", () => {
  let useCase: EnrollStudentUseCase;
  let mockEnrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockStudentRepository: jest.Mocked<StudentRepository>;

  const campusId = "campus-1";
  const differentCampusId = "campus-2";
  const classId = "class-1";
  const studentId = "student-1";
  const enrollmentDate = new Date("2024-01-15");

  // Helper to create a mock Class entity. Default SchoolYear range is wide
  // (2020-01-01 → 2030-12-31) so existing tests using `2024-01-15` enrollmentDate
  // continue to pass. Override `schoolYearRange` for date-bounds tests.
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
        name: "Test School Year",
        startDate: range.startDate,
        endDate: range.endDate,
      },
      "school-year-1",
    );
    return Class.create(
      {
        name: "Test Class",
        campusId: ownerCampusId,
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
        description: null,
        schoolYear,
      },
      classId,
    );
  };

  // Helper to create a mock Student entity
  const createMockStudent = (
    overrides: { campusId?: string } = {},
  ): Student => {
    return Student.create(
      {
        campusId: overrides.campusId ?? campusId,
        studentCode: "STU001",
        fullName: "Test Student",
        email: "student@test.com",
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      },
      studentId,
    );
  };

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

    useCase = new EnrollStudentUseCase(
      mockEnrollmentRepository,
      mockClassRepository,
      mockStudentRepository,
    );

    // Default: no active enrollment. Individual tests override for AC-21.
    mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
  });

  it("should enroll a student successfully", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent();

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
    mockEnrollmentRepository.save.mockImplementation(
      async (enrollment) => enrollment,
    );

    const result = await useCase.execute({
      campusId,
      classId,
      studentId,
      enrollmentDate,
      note: "Test enrollment note",
    });

    expect(result).toBeInstanceOf(Enrollment);
    expect(result.classId).toBe(classId);
    expect(result.studentId).toBe(studentId);
    expect(result.enrollmentDate).toEqual(enrollmentDate);
    expect(result.note).toBe("Test enrollment note");

    expect(mockClassRepository.findById).toHaveBeenCalledWith(classId);
    expect(mockStudentRepository.findById).toHaveBeenCalledWith(studentId);
    expect(
      mockEnrollmentRepository.findByStudentClassDate,
    ).toHaveBeenCalledWith(studentId, classId, enrollmentDate);
    expect(mockEnrollmentRepository.save).toHaveBeenCalled();
  });

  it("should enroll a student without a note", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent();

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
    mockEnrollmentRepository.save.mockImplementation(
      async (enrollment) => enrollment,
    );

    const result = await useCase.execute({
      campusId,
      classId,
      studentId,
      enrollmentDate,
    });

    expect(result.note).toBeNull();
  });

  it("should throw NotFoundException when class does not exist", async () => {
    mockClassRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow(NotFoundException);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow(`Class with ID ${classId} not found`);

    expect(mockStudentRepository.findById).not.toHaveBeenCalled();
    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should throw BadRequestException when class belongs to a different campus", async () => {
    const mockClass = createMockClass({ campusId: differentCampusId });

    mockClassRepository.findById.mockResolvedValue(mockClass);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow("Class does not belong to this campus");

    expect(mockStudentRepository.findById).not.toHaveBeenCalled();
    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should throw NotFoundException when student does not exist", async () => {
    const mockClass = createMockClass();

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow(NotFoundException);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow(`Student with ID ${studentId} not found`);

    expect(
      mockEnrollmentRepository.findByStudentClassDate,
    ).not.toHaveBeenCalled();
    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should throw BadRequestException when student belongs to a different campus (cross-campus rejection)", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent({ campusId: differentCampusId });

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow(
      "Cannot enroll student from a different campus into this class",
    );

    expect(
      mockEnrollmentRepository.findByStudentClassDate,
    ).not.toHaveBeenCalled();
    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should throw ConflictException when duplicate enrollment exists on same date", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent();
    const existingEnrollment = Enrollment.create({
      classId,
      studentId,
      enrollmentDate,
      note: null,
    });

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(
      existingEnrollment,
    );

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow(ConflictException);

    await expect(
      useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      }),
    ).rejects.toThrow("Student is already enrolled in this class on this date");

    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should allow enrollment on different dates for same student and class", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent();
    const newEnrollmentDate = new Date("2024-02-01");

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
    mockEnrollmentRepository.save.mockImplementation(
      async (enrollment) => enrollment,
    );

    const result = await useCase.execute({
      campusId,
      classId,
      studentId,
      enrollmentDate: newEnrollmentDate,
    });

    expect(result.enrollmentDate).toEqual(newEnrollmentDate);
    expect(mockEnrollmentRepository.save).toHaveBeenCalled();
  });

  describe("AC-21 / Scenario 9: student already actively enrolled (any class)", () => {
    it("throws ConflictException STUDENT_ALREADY_ENROLLED when student has any active enrollment", async () => {
      const mockClass = createMockClass();
      const mockStudent = createMockStudent();
      const activeElsewhere = Enrollment.create({
        classId: "other-class",
        studentId,
        enrollmentDate: new Date("2024-01-01"),
        endDate: null,
        exitReason: null,
        note: null,
      });

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        activeElsewhere,
      );

      await expect(
        useCase.execute({
          campusId,
          classId,
          studentId,
          enrollmentDate,
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          studentId,
          enrollmentDate,
        }),
      ).rejects.toThrow("STUDENT_ALREADY_ENROLLED");

      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("AC-22 / Scenario 4: re-enroll after withdraw", () => {
    it("succeeds when student has no active enrollment (post-withdraw regression)", async () => {
      const mockClass = createMockClass();
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockEnrollmentRepository.save.mockImplementation(async (e) => e);

      const result = await useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate,
      });

      expect(result).toBeInstanceOf(Enrollment);
      expect(
        mockEnrollmentRepository.findActiveByStudentId,
      ).toHaveBeenCalledWith(studentId);
      expect(mockEnrollmentRepository.save).toHaveBeenCalled();
    });
  });

  describe("AC-27 / Scenario 10: enrollmentDate outside school year", () => {
    it("rejects enrollmentDate before schoolYear.startDate with ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR", async () => {
      const mockClass = createMockClass({
        schoolYearRange: {
          startDate: new Date("2024-09-01T00:00:00.000Z"),
          endDate: new Date("2025-06-30T00:00:00.000Z"),
        },
      });
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);

      await expect(
        useCase.execute({
          campusId,
          classId,
          studentId,
          enrollmentDate: new Date("2024-08-15T00:00:00.000Z"),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          studentId,
          enrollmentDate: new Date("2024-08-15T00:00:00.000Z"),
        }),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");

      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
      expect(
        mockEnrollmentRepository.findActiveByStudentId,
      ).not.toHaveBeenCalled();
    });

    it("rejects enrollmentDate after schoolYear.endDate with ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR", async () => {
      const mockClass = createMockClass({
        schoolYearRange: {
          startDate: new Date("2024-09-01T00:00:00.000Z"),
          endDate: new Date("2025-06-30T00:00:00.000Z"),
        },
      });
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);

      await expect(
        useCase.execute({
          campusId,
          classId,
          studentId,
          enrollmentDate: new Date("2025-08-15T00:00:00.000Z"),
        }),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");

      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
    });

    it("accepts enrollmentDate exactly on schoolYear.startDate (inclusive boundary)", async () => {
      const startDate = new Date("2024-09-01T00:00:00.000Z");
      const mockClass = createMockClass({
        schoolYearRange: {
          startDate,
          endDate: new Date("2025-06-30T00:00:00.000Z"),
        },
      });
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockEnrollmentRepository.save.mockImplementation(async (e) => e);

      const result = await useCase.execute({
        campusId,
        classId,
        studentId,
        enrollmentDate: startDate,
      });

      expect(result).toBeInstanceOf(Enrollment);
      expect(mockEnrollmentRepository.save).toHaveBeenCalled();
    });
  });

  describe("validation order", () => {
    it("checks school-year bounds before active-anywhere when both would fail", async () => {
      const mockClass = createMockClass({
        schoolYearRange: {
          startDate: new Date("2024-09-01T00:00:00.000Z"),
          endDate: new Date("2025-06-30T00:00:00.000Z"),
        },
      });
      const mockStudent = createMockStudent();
      const activeElsewhere = Enrollment.create({
        classId: "other-class",
        studentId,
        enrollmentDate: new Date("2024-10-01"),
        endDate: null,
        exitReason: null,
        note: null,
      });

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        activeElsewhere,
      );

      // Both would fail: enrollmentDate is out-of-range AND student has active enrollment.
      // Spec validation order: school-year bounds fires first (400, not 409).
      await expect(
        useCase.execute({
          campusId,
          classId,
          studentId,
          enrollmentDate: new Date("2024-08-15T00:00:00.000Z"),
        }),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");

      // findActiveByStudentId should not have been consulted yet.
      expect(
        mockEnrollmentRepository.findActiveByStudentId,
      ).not.toHaveBeenCalled();
    });
  });
});
