import { NotFoundException, BadRequestException } from "@nestjs/common";
import { RestoreStudentUseCase } from "./restore-student.use-case";
import { StudentRepository } from "../../ports/student.repository";
import { Student } from "@/domain/user-management/entities/student.entity";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";

describe("RestoreStudentUseCase", () => {
  let useCase: RestoreStudentUseCase;
  let mockStudentRepository: jest.Mocked<StudentRepository>;

  const createMockStudent = (
    overrides: Partial<{
      id: string;
      campusId: string;
      isArchived: boolean;
      status: StudentStatus;
    }> = {},
  ) => {
    return Student.create(
      {
        campusId: overrides.campusId ?? "campus-123",
        studentCode: "STU-001",
        fullName: "Test Student",
        email: "test@example.com",
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
        status: overrides.status ?? StudentStatus.ACTIVE,
        isArchived: overrides.isArchived ?? false,
      },
      overrides.id ?? "student-123",
    );
  };

  beforeEach(() => {
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

    useCase = new RestoreStudentUseCase(mockStudentRepository);
  });

  describe("successful restore", () => {
    it("should restore an archived student successfully", async () => {
      const student = createMockStudent({
        isArchived: true,
        status: StudentStatus.DROPPED,
      });
      mockStudentRepository.findById.mockResolvedValue(student);
      mockStudentRepository.update.mockImplementation(async (s) => s);

      const result = await useCase.execute("student-123");

      expect(result.isArchived).toBe(false);
      expect(result.status).toBe(StudentStatus.ACTIVE);
      expect(mockStudentRepository.findById).toHaveBeenCalledWith(
        "student-123",
      );
      expect(mockStudentRepository.update).toHaveBeenCalledWith(student);
    });

    it("should restore a student with campus validation", async () => {
      const student = createMockStudent({
        campusId: "campus-123",
        isArchived: true,
        status: StudentStatus.DROPPED,
      });
      mockStudentRepository.findById.mockResolvedValue(student);
      mockStudentRepository.update.mockImplementation(async (s) => s);

      const result = await useCase.execute("student-123", "campus-123");

      expect(result.isArchived).toBe(false);
      expect(result.status).toBe(StudentStatus.ACTIVE);
      expect(mockStudentRepository.update).toHaveBeenCalled();
    });
  });

  describe("student not found", () => {
    it("should throw NotFoundException if student not found", async () => {
      mockStudentRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute("non-existent-id")).rejects.toThrow(
        "Student with ID non-existent-id not found",
      );
    });
  });

  describe("student not archived", () => {
    it("should throw BadRequestException if student is not archived", async () => {
      const student = createMockStudent({
        isArchived: false,
        status: StudentStatus.ACTIVE,
      });
      mockStudentRepository.findById.mockResolvedValue(student);

      await expect(useCase.execute("student-123")).rejects.toThrow(
        BadRequestException,
      );
      await expect(useCase.execute("student-123")).rejects.toThrow(
        "Student with ID student-123 is not archived",
      );
    });
  });

  describe("campus validation", () => {
    it("should throw NotFoundException if student belongs to different campus", async () => {
      const student = createMockStudent({
        campusId: "campus-A",
        isArchived: true,
        status: StudentStatus.DROPPED,
      });
      mockStudentRepository.findById.mockResolvedValue(student);

      await expect(useCase.execute("student-123", "campus-B")).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute("student-123", "campus-B")).rejects.toThrow(
        "Student with ID student-123 not found in this campus",
      );
    });

    it("should restore successfully when no campusId is provided (skip validation)", async () => {
      const student = createMockStudent({
        campusId: "campus-123",
        isArchived: true,
        status: StudentStatus.DROPPED,
      });
      mockStudentRepository.findById.mockResolvedValue(student);
      mockStudentRepository.update.mockImplementation(async (s) => s);

      const result = await useCase.execute("student-123");

      expect(result.isArchived).toBe(false);
      expect(mockStudentRepository.update).toHaveBeenCalled();
    });
  });
});
