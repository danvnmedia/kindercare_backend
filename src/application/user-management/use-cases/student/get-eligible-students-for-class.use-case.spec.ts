import { NotFoundException } from "@nestjs/common";

import { GetEligibleStudentsForClassUseCase } from "./get-eligible-students-for-class.use-case";
import { StudentRepository } from "../../ports/student.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  createMockClassRepository,
  createMockStudentRepository,
} from "@/test-utils/mock-repository-factory";

describe("GetEligibleStudentsForClassUseCase", () => {
  let useCase: GetEligibleStudentsForClassUseCase;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockStudentRepository: jest.Mocked<StudentRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";

  const buildClass = (overrides: { campusId?: string } = {}): Class => {
    const owner = overrides.campusId ?? campusId;
    const schoolYear = SchoolYear.create(
      {
        campusId: owner,
        name: "Test SY",
        startDate: new Date("2020-01-01T00:00:00.000Z"),
        endDate: new Date("2030-12-31T00:00:00.000Z"),
      },
      "school-year-1",
    );
    return Class.create(
      {
        name: "Test Class",
        campusId: owner,
        gradeLevelId: "grade-1",
        schoolYearId: "school-year-1",
        description: null,
        schoolYear,
      },
      classId,
    );
  };

  const emptyResult = {
    data: [],
    pagination: {
      count: 0,
      limit: 10,
      offset: 0,
      totalPages: 0,
      currentPage: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  beforeEach(() => {
    mockClassRepository = createMockClassRepository();
    mockStudentRepository = createMockStudentRepository();
    mockStudentRepository.findEligibleForClass.mockResolvedValue(emptyResult);
    useCase = new GetEligibleStudentsForClassUseCase(
      mockClassRepository,
      mockStudentRepository,
    );
  });

  describe("class lookup (D5)", () => {
    it("throws NotFoundException when the class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ classId, campusId, params: {} }),
      ).rejects.toThrow(NotFoundException);
      expect(mockStudentRepository.findEligibleForClass).not.toHaveBeenCalled();
    });

    it("hides existence of cross-campus classes by returning the same 404 body", async () => {
      mockClassRepository.findById.mockResolvedValue(
        buildClass({ campusId: otherCampusId }),
      );

      await expect(
        useCase.execute({ classId, campusId, params: {} }),
      ).rejects.toThrow(
        new NotFoundException(`Class with ID ${classId} not found`),
      );
      expect(mockStudentRepository.findEligibleForClass).not.toHaveBeenCalled();
    });
  });

  describe("filter construction", () => {
    beforeEach(() => {
      mockClassRepository.findById.mockResolvedValue(buildClass());
    });

    it("defaults includeStatuses to [ACTIVE] when omitted", async () => {
      const params: StandardRequest = {};

      await useCase.execute({ classId, campusId, params });

      expect(mockStudentRepository.findEligibleForClass).toHaveBeenCalledTimes(
        1,
      );
      const [calledClassId, calledParams, scope] =
        mockStudentRepository.findEligibleForClass.mock.calls[0];
      expect(calledClassId).toBe(classId);
      expect(scope).toEqual({ campusId });
      expect(calledParams.filterInfo?.filters).toEqual({
        status: { in: [StudentStatus.ACTIVE] },
      });
    });

    it("forwards explicit includeStatuses verbatim", async () => {
      await useCase.execute({
        classId,
        campusId,
        params: {},
        includeStatuses: [StudentStatus.ACTIVE, StudentStatus.WAITING],
      });

      const [, calledParams] =
        mockStudentRepository.findEligibleForClass.mock.calls[0];
      expect(calledParams.filterInfo?.filters).toEqual({
        status: { in: [StudentStatus.ACTIVE, StudentStatus.WAITING] },
      });
    });

    it("ignores empty includeStatuses arrays and falls back to ACTIVE", async () => {
      await useCase.execute({
        classId,
        campusId,
        params: {},
        includeStatuses: [],
      });

      const [, calledParams] =
        mockStudentRepository.findEligibleForClass.mock.calls[0];
      expect(calledParams.filterInfo?.filters).toEqual({
        status: { in: [StudentStatus.ACTIVE] },
      });
    });

    it("adds fullName ilike filter when search is provided", async () => {
      await useCase.execute({
        classId,
        campusId,
        params: {},
        search: "Anh",
      });

      const [, calledParams] =
        mockStudentRepository.findEligibleForClass.mock.calls[0];
      expect(calledParams.filterInfo?.filters).toEqual({
        status: { in: [StudentStatus.ACTIVE] },
        fullName: { ilike: "Anh" },
      });
    });

    it("trims search input and ignores empty/whitespace strings", async () => {
      await useCase.execute({
        classId,
        campusId,
        params: {},
        search: "   ",
      });

      const [, calledParams] =
        mockStudentRepository.findEligibleForClass.mock.calls[0];
      expect(calledParams.filterInfo?.filters).not.toHaveProperty("fullName");
    });
  });

  describe("repository delegation (AC-21 contract)", () => {
    it("passes the standard request through to the repository unchanged outside filterInfo", async () => {
      mockClassRepository.findById.mockResolvedValue(buildClass());
      const params: StandardRequest = {
        limit: 25,
        offset: 50,
        sort: "fullName",
      };

      await useCase.execute({ classId, campusId, params });

      const [calledClassId, calledParams, scope] =
        mockStudentRepository.findEligibleForClass.mock.calls[0];
      expect(calledClassId).toBe(classId);
      expect(calledParams.limit).toBe(25);
      expect(calledParams.offset).toBe(50);
      expect(calledParams.sort).toBe("fullName");
      expect(scope).toEqual({ campusId });
    });

    it("returns the paginated result from the repository as-is", async () => {
      mockClassRepository.findById.mockResolvedValue(buildClass());

      const result = await useCase.execute({ classId, campusId, params: {} });

      expect(result).toBe(emptyResult);
    });
  });
});
