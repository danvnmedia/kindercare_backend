import { BadRequestException, NotFoundException } from "@nestjs/common";
import { RemoveStaffFromClassUseCase } from "./remove-staff-from-class.use-case";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";

describe("RemoveStaffFromClassUseCase", () => {
  let useCase: RemoveStaffFromClassUseCase;
  let mockClassStaffRepository: jest.Mocked<ClassStaffRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";
  const staffId = "staff-1";
  const subjectId = "subject-1";

  const createMockClass = (id: string, belongsToCampusId: string): Class =>
    Class.create(
      {
        name: "Test Class",
        campusId: belongsToCampusId,
        gradeLevelId: "grade-1",
        schoolYearId: "school-year-1",
      },
      id,
    );

  const createMockAssignment = (): ClassStaff =>
    ClassStaff.create({ classId, staffId, subjectId });

  beforeEach(() => {
    mockClassStaffRepository = {
      findByCompositeKey: jest.fn(),
      findByClassId: jest.fn(),
      findByStaffId: jest.fn(),
      findBySubjectId: jest.fn(),
      findByClassAndSubject: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      deleteByClassId: jest.fn(),
      deleteByStaffId: jest.fn(),
    } as jest.Mocked<ClassStaffRepository>;

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

    useCase = new RemoveStaffFromClassUseCase(
      mockClassStaffRepository,
      mockClassRepository,
    );
  });

  describe("Success scenarios", () => {
    it("should remove staff from class when class belongs to campus and assignment exists", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByCompositeKey.mockResolvedValue(
        createMockAssignment(),
      );
      mockClassStaffRepository.delete.mockResolvedValue(undefined);

      await useCase.execute({ campusId, classId, staffId, subjectId });

      expect(mockClassRepository.findById).toHaveBeenCalledWith(classId);
      expect(mockClassStaffRepository.findByCompositeKey).toHaveBeenCalledWith(
        classId,
        staffId,
        subjectId,
      );
      expect(mockClassStaffRepository.delete).toHaveBeenCalledWith(
        classId,
        staffId,
        subjectId,
      );
    });
  });

  describe("Class validation", () => {
    it("should throw NotFoundException when class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ campusId, classId, staffId, subjectId }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({ campusId, classId, staffId, subjectId }),
      ).rejects.toThrow(`Class with ID ${classId} not found`);

      expect(
        mockClassStaffRepository.findByCompositeKey,
      ).not.toHaveBeenCalled();
      expect(mockClassStaffRepository.delete).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when class belongs to a different campus (cross-campus rejection)", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, otherCampusId),
      );

      await expect(
        useCase.execute({ campusId, classId, staffId, subjectId }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({ campusId, classId, staffId, subjectId }),
      ).rejects.toThrow("Class does not belong to this campus");

      expect(
        mockClassStaffRepository.findByCompositeKey,
      ).not.toHaveBeenCalled();
      expect(mockClassStaffRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("Assignment validation", () => {
    it("should throw NotFoundException when assignment does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByCompositeKey.mockResolvedValue(null);

      await expect(
        useCase.execute({ campusId, classId, staffId, subjectId }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({ campusId, classId, staffId, subjectId }),
      ).rejects.toThrow(
        "Staff assignment not found for this class and subject",
      );

      expect(mockClassStaffRepository.delete).not.toHaveBeenCalled();
    });
  });
});
