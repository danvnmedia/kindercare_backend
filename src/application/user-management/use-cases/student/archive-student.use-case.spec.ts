import { NotFoundException } from "@nestjs/common";
import { ArchiveStudentUseCase } from "./archive-student.use-case";
import { StudentRepository } from "../../ports/student.repository";
import { Student } from "@/domain/user-management/entities/student.entity";

describe("ArchiveStudentUseCase", () => {
  let useCase: ArchiveStudentUseCase;
  let mockStudentRepository: jest.Mocked<StudentRepository>;

  const createMockStudent = (
    overrides: Partial<{
      id: string;
      campusId: string;
      isArchived: boolean;
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

    useCase = new ArchiveStudentUseCase(mockStudentRepository);
  });

  describe("successful archive", () => {
    it("should archive a student successfully", async () => {
      const student = createMockStudent();
      mockStudentRepository.findById.mockResolvedValue(student);
      mockStudentRepository.update.mockImplementation(async (s) => s);

      const result = await useCase.execute("student-123");

      expect(result.isArchived).toBe(true);
      expect(mockStudentRepository.findById).toHaveBeenCalledWith(
        "student-123",
      );
      expect(mockStudentRepository.update).toHaveBeenCalledWith(student);
    });

    it("should archive a student with campus validation", async () => {
      const student = createMockStudent({ campusId: "campus-123" });
      mockStudentRepository.findById.mockResolvedValue(student);
      mockStudentRepository.update.mockImplementation(async (s) => s);

      const result = await useCase.execute("student-123", "campus-123");

      expect(result.isArchived).toBe(true);
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

  describe("campus validation", () => {
    it("should throw NotFoundException if student belongs to different campus", async () => {
      const student = createMockStudent({ campusId: "campus-A" });
      mockStudentRepository.findById.mockResolvedValue(student);

      await expect(useCase.execute("student-123", "campus-B")).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.execute("student-123", "campus-B")).rejects.toThrow(
        "Student with ID student-123 not found in this campus",
      );
    });

    it("should archive successfully when no campusId is provided (skip validation)", async () => {
      const student = createMockStudent({ campusId: "campus-123" });
      mockStudentRepository.findById.mockResolvedValue(student);
      mockStudentRepository.update.mockImplementation(async (s) => s);

      const result = await useCase.execute("student-123");

      expect(result.isArchived).toBe(true);
      expect(mockStudentRepository.update).toHaveBeenCalled();
    });
  });
});
