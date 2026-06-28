/**
 * UpdateSchoolYearUseCase Unit Tests
 * Tests campus validation and update functionality
 */

import { NotFoundException, ConflictException } from "@nestjs/common";
import { UpdateSchoolYearUseCase } from "./update-school-year.use-case";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  createSchoolYear,
  createMockSchoolYearRepository,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

describe("UpdateSchoolYearUseCase", () => {
  let useCase: UpdateSchoolYearUseCase;
  let mockSchoolYearRepository: jest.Mocked<SchoolYearRepository>;

  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  beforeEach(() => {
    mockSchoolYearRepository = createMockSchoolYearRepository();
    useCase = new UpdateSchoolYearUseCase(mockSchoolYearRepository);
  });

  describe("Campus Validation", () => {
    it("should throw NotFoundException when school year does not exist", async () => {
      mockSchoolYearRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("non-existent-id", {
          campusId: campusA,
          name: "Updated Name",
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute("non-existent-id", {
          campusId: campusA,
          name: "Updated Name",
        }),
      ).rejects.toThrow("School year with ID non-existent-id not found");
    });

    it("should throw NotFoundException when school year belongs to different campus", async () => {
      // School year in campus B
      const schoolYear = createSchoolYear({
        id: "school-year-1",
        campusId: campusB,
        name: "2025-2026",
      });

      mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);

      // Request with campus A context
      await expect(
        useCase.execute("school-year-1", {
          campusId: campusA,
          name: "Updated Name",
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute("school-year-1", {
          campusId: campusA,
          name: "Updated Name",
        }),
      ).rejects.toThrow(
        "School year with ID school-year-1 not found in this campus",
      );

      // Update should not be called
      expect(mockSchoolYearRepository.update).not.toHaveBeenCalled();
    });

    it("should allow update when school year belongs to the same campus", async () => {
      const schoolYear = createSchoolYear({
        id: "school-year-1",
        campusId: campusA,
        name: "2025-2026",
      });

      mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);
      mockSchoolYearRepository.findByNameAndCampus.mockResolvedValue(null);
      mockSchoolYearRepository.update.mockImplementation(async (sy) => sy);

      const result = await useCase.execute("school-year-1", {
        campusId: campusA,
        name: "2026-2027",
      });

      expect(result).toBeDefined();
      expect(result.name).toBe("2026-2027");
      expect(mockSchoolYearRepository.update).toHaveBeenCalled();
    });

    it("should allow update when campusId is not provided in input", async () => {
      // This tests backwards compatibility where campusId might not be passed
      const schoolYear = createSchoolYear({
        id: "school-year-1",
        campusId: campusA,
        name: "2025-2026",
      });

      mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);
      mockSchoolYearRepository.findByNameAndCampus.mockResolvedValue(null);
      mockSchoolYearRepository.update.mockImplementation(async (sy) => sy);

      // No campusId in input - should still work
      const result = await useCase.execute("school-year-1", {
        name: "2026-2027",
      });

      expect(result).toBeDefined();
      expect(result.name).toBe("2026-2027");
      expect(mockSchoolYearRepository.update).toHaveBeenCalled();
    });
  });

  describe("Name Uniqueness Validation", () => {
    it("should throw ConflictException when name already exists in campus", async () => {
      const schoolYear = createSchoolYear({
        id: "school-year-1",
        campusId: campusA,
        name: "2025-2026",
      });

      const existingSchoolYear = createSchoolYear({
        id: "school-year-2",
        campusId: campusA,
        name: "2024-2025",
      });

      mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);
      mockSchoolYearRepository.findByNameAndCampus.mockResolvedValue(
        existingSchoolYear,
      );

      await expect(
        useCase.execute("school-year-1", {
          campusId: campusA,
          name: "2024-2025",
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute("school-year-1", {
          campusId: campusA,
          name: "2024-2025",
        }),
      ).rejects.toThrow('School year "2024-2025" already exists');
    });

    it("should allow update when name is unchanged", async () => {
      const schoolYear = createSchoolYear({
        id: "school-year-1",
        campusId: campusA,
        name: "2025-2026",
      });

      mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);
      mockSchoolYearRepository.update.mockImplementation(async (sy) => sy);

      const result = await useCase.execute("school-year-1", {
        campusId: campusA,
        name: "2025-2026", // Same name
      });

      expect(result).toBeDefined();
      // Should not check for name uniqueness when name is unchanged
      expect(
        mockSchoolYearRepository.findByNameAndCampus,
      ).not.toHaveBeenCalled();
    });
  });

  describe("Partial Updates", () => {
    it("should update only name when only name is provided", async () => {
      const originalStartDate = new Date("2025-09-01");
      const originalEndDate = new Date("2026-06-30");

      const schoolYear = createSchoolYear({
        id: "school-year-1",
        campusId: campusA,
        name: "2025-2026",
        startDate: originalStartDate,
        endDate: originalEndDate,
      });

      mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);
      mockSchoolYearRepository.findByNameAndCampus.mockResolvedValue(null);
      mockSchoolYearRepository.update.mockImplementation(async (sy) => sy);

      const result = await useCase.execute("school-year-1", {
        campusId: campusA,
        name: "2026-2027",
      });

      expect(result.name).toBe("2026-2027");
    });

    it("should update dates when provided", async () => {
      const schoolYear = createSchoolYear({
        id: "school-year-1",
        campusId: campusA,
        name: "2025-2026",
      });

      mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);
      mockSchoolYearRepository.update.mockImplementation(async (sy) => sy);

      const newStartDate = new Date("2026-09-01");
      const newEndDate = new Date("2027-06-30");

      const result = await useCase.execute("school-year-1", {
        campusId: campusA,
        startDate: newStartDate,
        endDate: newEndDate,
      });

      expect(result).toBeDefined();
      expect(mockSchoolYearRepository.update).toHaveBeenCalled();
    });

    it("should update isArchived status", async () => {
      const schoolYear = createSchoolYear({
        id: "school-year-1",
        campusId: campusA,
        name: "2025-2026",
      });

      mockSchoolYearRepository.findById.mockResolvedValue(schoolYear);
      mockSchoolYearRepository.update.mockImplementation(async (sy) => sy);

      const result = await useCase.execute("school-year-1", {
        campusId: campusA,
        isArchived: true,
      });

      expect(result).toBeDefined();
      expect(mockSchoolYearRepository.update).toHaveBeenCalled();
    });
  });
});
