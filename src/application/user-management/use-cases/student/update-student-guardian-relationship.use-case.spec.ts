import { BadRequestException, NotFoundException } from "@nestjs/common";
import { UpdateStudentGuardianRelationshipUseCase } from "./update-student-guardian-relationship.use-case";
import { StudentRepository } from "../../ports/student.repository";
import { GuardianRepository } from "../../ports/guardian.repository";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";

describe("UpdateStudentGuardianRelationshipUseCase", () => {
  let useCase: UpdateStudentGuardianRelationshipUseCase;
  let mockStudentRepository: jest.Mocked<StudentRepository>;
  let mockGuardianRepository: jest.Mocked<GuardianRepository>;
  let mockGuardianRelationshipTypeRepository: jest.Mocked<GuardianRelationshipTypeRepository>;

  const campusId = "campus-123";
  const differentCampusId = "campus-456";
  const studentId = "student-123";
  const guardianId = "guardian-123";
  const relationshipId = "relationship-123";
  const otherRelationshipId = "relationship-456";

  const createMockStudent = (
    overrides: Partial<{ campusId: string }> = {},
  ): Student => {
    return Student.create(
      {
        campusId: overrides.campusId ?? campusId,
        studentCode: "STU-001",
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

  const createMockGuardian = (
    overrides: Partial<{ campusId: string }> = {},
  ): Guardian => {
    return Guardian.create(
      {
        campusId: overrides.campusId ?? campusId,
        fullName: "Test Guardian",
        email: "guardian@test.com",
        phoneNumber: "+84912345678",
        address: null,
        dateOfBirth: null,
        gender: null,
        occupation: null,
        workAddress: null,
      },
      guardianId,
    );
  };

  const createMockRelationshipType = (
    overrides: Partial<{
      id: string;
      name: string;
      isArchived: boolean;
    }> = {},
  ): GuardianRelationshipType => {
    return GuardianRelationshipType.create(
      {
        campusId,
        name: overrides.name ?? "Mother",
        description: null,
        order: 1,
        isArchived: overrides.isArchived ?? false,
      },
      overrides.id ?? relationshipId,
    );
  };

  const createExistingLink = (
    overrides: Partial<{ relationship: string }> = {},
  ) => ({
    guardianId,
    fullName: "Test Guardian",
    email: "guardian@test.com",
    phoneNumber: "+84912345678",
    relationship: overrides.relationship ?? otherRelationshipId,
    relationshipName: "Father",
  });

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

    mockGuardianRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailInCampus: jest.fn(),
      findByPhoneNumber: jest.fn(),
      findByPhoneNumberInCampus: jest.fn(),
      findByUserId: jest.fn(),
      findByCampusId: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getGuardianChildren: jest.fn(),
    } as jest.Mocked<GuardianRepository>;

    mockGuardianRelationshipTypeRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findByOrderAndCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      existsAndNotArchived: jest.fn(),
      getMaxOrder: jest.fn(),
      reorder: jest.fn(),
    } as jest.Mocked<GuardianRelationshipTypeRepository>;

    useCase = new UpdateStudentGuardianRelationshipUseCase(
      mockStudentRepository,
      mockGuardianRepository,
      mockGuardianRelationshipTypeRepository,
    );
  });

  describe("happy path", () => {
    it("should update the relationship and return the updated DTO", async () => {
      const relationshipType = createMockRelationshipType({ name: "Mother" });
      const student = createMockStudent();
      const guardian = createMockGuardian();

      mockGuardianRelationshipTypeRepository.findById.mockResolvedValue(
        relationshipType,
      );
      mockStudentRepository.findById.mockResolvedValue(student);
      mockGuardianRepository.findById.mockResolvedValue(guardian);
      mockStudentRepository.getStudentGuardians.mockResolvedValue([
        createExistingLink(),
      ]);
      mockStudentRepository.updateGuardianRelationship.mockResolvedValue(
        undefined,
      );

      const result = await useCase.execute({
        studentId,
        guardianId,
        campusId,
        relationshipId,
      });

      expect(result).toEqual({
        studentId,
        guardianId,
        relationshipId,
        relationshipName: "Mother",
      });

      expect(
        mockStudentRepository.updateGuardianRelationship,
      ).toHaveBeenCalledWith(studentId, guardianId, relationshipId);
    });
  });

  describe("relationship type validation", () => {
    it("should throw NotFoundException when relationshipId does not exist", async () => {
      mockGuardianRelationshipTypeRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(
        `Guardian relationship type with ID "${relationshipId}" not found`,
      );

      expect(mockStudentRepository.findById).not.toHaveBeenCalled();
      expect(
        mockStudentRepository.updateGuardianRelationship,
      ).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when relationship type is archived", async () => {
      const archivedType = createMockRelationshipType({
        name: "Deprecated",
        isArchived: true,
      });
      mockGuardianRelationshipTypeRepository.findById.mockResolvedValue(
        archivedType,
      );

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(
        `Guardian relationship type "Deprecated" is archived and cannot be used`,
      );

      expect(mockStudentRepository.findById).not.toHaveBeenCalled();
      expect(
        mockStudentRepository.updateGuardianRelationship,
      ).not.toHaveBeenCalled();
    });
  });

  describe("campus scoping", () => {
    it("should throw NotFoundException when student belongs to a different campus", async () => {
      const relationshipType = createMockRelationshipType();
      const student = createMockStudent({ campusId: differentCampusId });

      mockGuardianRelationshipTypeRepository.findById.mockResolvedValue(
        relationshipType,
      );
      mockStudentRepository.findById.mockResolvedValue(student);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(
        `Student with ID ${studentId} not found in this campus`,
      );

      expect(mockGuardianRepository.findById).not.toHaveBeenCalled();
      expect(
        mockStudentRepository.updateGuardianRelationship,
      ).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when guardian belongs to a different campus", async () => {
      const relationshipType = createMockRelationshipType();
      const student = createMockStudent();
      const guardian = createMockGuardian({ campusId: differentCampusId });

      mockGuardianRelationshipTypeRepository.findById.mockResolvedValue(
        relationshipType,
      );
      mockStudentRepository.findById.mockResolvedValue(student);
      mockGuardianRepository.findById.mockResolvedValue(guardian);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(
        `Guardian with ID ${guardianId} not found in this campus`,
      );

      expect(mockStudentRepository.getStudentGuardians).not.toHaveBeenCalled();
      expect(
        mockStudentRepository.updateGuardianRelationship,
      ).not.toHaveBeenCalled();
    });
  });

  describe("link existence", () => {
    it("should throw NotFoundException when student and guardian are not linked", async () => {
      const relationshipType = createMockRelationshipType();
      const student = createMockStudent();
      const guardian = createMockGuardian();

      mockGuardianRelationshipTypeRepository.findById.mockResolvedValue(
        relationshipType,
      );
      mockStudentRepository.findById.mockResolvedValue(student);
      mockGuardianRepository.findById.mockResolvedValue(guardian);
      mockStudentRepository.getStudentGuardians.mockResolvedValue([]);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({ studentId, guardianId, campusId, relationshipId }),
      ).rejects.toThrow(
        `Guardian ${guardianId} is not linked to student ${studentId}`,
      );

      expect(
        mockStudentRepository.updateGuardianRelationship,
      ).not.toHaveBeenCalled();
    });
  });

  describe("no-op update", () => {
    it("should still update and return the DTO when relationshipId matches current value", async () => {
      const relationshipType = createMockRelationshipType({ name: "Father" });
      const student = createMockStudent();
      const guardian = createMockGuardian();

      mockGuardianRelationshipTypeRepository.findById.mockResolvedValue(
        relationshipType,
      );
      mockStudentRepository.findById.mockResolvedValue(student);
      mockGuardianRepository.findById.mockResolvedValue(guardian);
      mockStudentRepository.getStudentGuardians.mockResolvedValue([
        createExistingLink({ relationship: relationshipId }),
      ]);
      mockStudentRepository.updateGuardianRelationship.mockResolvedValue(
        undefined,
      );

      const result = await useCase.execute({
        studentId,
        guardianId,
        campusId,
        relationshipId,
      });

      expect(result).toEqual({
        studentId,
        guardianId,
        relationshipId,
        relationshipName: "Father",
      });
      expect(
        mockStudentRepository.updateGuardianRelationship,
      ).toHaveBeenCalledWith(studentId, guardianId, relationshipId);
    });
  });
});
