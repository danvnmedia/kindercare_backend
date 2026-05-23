import { NotFoundException } from "@nestjs/common";

import { GetEligibleStaffForClassUseCase } from "./get-eligible-staff-for-class.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  createMockClassRepository,
  createMockStaffRepository,
} from "@/test-utils/mock-repository-factory";

describe("GetEligibleStaffForClassUseCase", () => {
  let useCase: GetEligibleStaffForClassUseCase;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;

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
    mockStaffRepository = createMockStaffRepository();
    mockStaffRepository.findEligibleForClass.mockResolvedValue(emptyResult);
    useCase = new GetEligibleStaffForClassUseCase(
      mockClassRepository,
      mockStaffRepository,
    );
  });

  describe("class lookup (D9 / AC-12)", () => {
    it("throws NotFoundException when the class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ classId, campusId, params: {} }),
      ).rejects.toThrow(NotFoundException);
      expect(mockStaffRepository.findEligibleForClass).not.toHaveBeenCalled();
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
      expect(mockStaffRepository.findEligibleForClass).not.toHaveBeenCalled();
    });
  });

  describe("filter construction (AC-11)", () => {
    beforeEach(() => {
      mockClassRepository.findById.mockResolvedValue(buildClass());
    });

    it("produces an empty filter set when no search is provided", async () => {
      await useCase.execute({ classId, campusId, params: {} });

      const [calledClassId, calledParams, scope] =
        mockStaffRepository.findEligibleForClass.mock.calls[0];
      expect(calledClassId).toBe(classId);
      expect(scope).toEqual({ campusId });
      expect(calledParams.filterInfo?.filters).toEqual({});
    });

    it("adds fullName ilike filter when search is provided", async () => {
      await useCase.execute({
        classId,
        campusId,
        params: {},
        search: "Lan",
      });

      const [, calledParams] =
        mockStaffRepository.findEligibleForClass.mock.calls[0];
      expect(calledParams.filterInfo?.filters).toEqual({
        fullName: { ilike: "Lan" },
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
        mockStaffRepository.findEligibleForClass.mock.calls[0];
      expect(calledParams.filterInfo?.filters).not.toHaveProperty("fullName");
    });

    it("trims surrounding whitespace from the search term", async () => {
      await useCase.execute({
        classId,
        campusId,
        params: {},
        search: "  Lan  ",
      });

      const [, calledParams] =
        mockStaffRepository.findEligibleForClass.mock.calls[0];
      expect(calledParams.filterInfo?.filters).toEqual({
        fullName: { ilike: "Lan" },
      });
    });
  });

  describe("repository delegation (AC-10 / AC-13 contract)", () => {
    it("passes the standard request through to the repository unchanged outside filterInfo", async () => {
      mockClassRepository.findById.mockResolvedValue(buildClass());
      const params: StandardRequest = {
        limit: 25,
        offset: 50,
        sort: "fullName",
      };

      await useCase.execute({ classId, campusId, params });

      const [calledClassId, calledParams, scope] =
        mockStaffRepository.findEligibleForClass.mock.calls[0];
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
