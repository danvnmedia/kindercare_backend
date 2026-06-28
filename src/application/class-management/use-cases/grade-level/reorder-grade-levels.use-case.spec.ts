/**
 * ReorderGradeLevelsUseCase Unit Tests
 * Tests campus validation and reorder functionality
 */

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ReorderGradeLevelsUseCase } from "./reorder-grade-levels.use-case";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import {
  createGradeLevel,
  createMockGradeLevelRepository,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

describe("ReorderGradeLevelsUseCase", () => {
  let useCase: ReorderGradeLevelsUseCase;
  let mockGradeLevelRepository: jest.Mocked<GradeLevelRepository>;

  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  beforeEach(() => {
    mockGradeLevelRepository = createMockGradeLevelRepository();
    useCase = new ReorderGradeLevelsUseCase(mockGradeLevelRepository);
  });

  describe("Campus Validation", () => {
    it("should throw NotFoundException when any grade level belongs to different campus", async () => {
      // Grade level 1 in campus A (valid)
      const gradeLevel1 = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      // Grade level 2 in campus B (invalid - different campus)
      const gradeLevel2 = createGradeLevel({
        id: "grade-level-2",
        campusId: campusB,
        name: "Grade 2",
        order: 2,
      });

      // Use mockImplementation to return different values based on ID
      mockGradeLevelRepository.findById.mockImplementation(async (id) => {
        if (id === "grade-level-1") return gradeLevel1;
        if (id === "grade-level-2") return gradeLevel2;
        return null;
      });

      await expect(
        useCase.execute({
          campusId: campusA,
          ids: ["grade-level-1", "grade-level-2"],
        }),
      ).rejects.toThrow(
        new NotFoundException(
          "Grade level with ID grade-level-2 not found in this campus",
        ),
      );

      // Reorder should not be called
      expect(mockGradeLevelRepository.reorder).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException immediately when first ID belongs to different campus", async () => {
      // Grade level in campus B (invalid)
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusB,
        name: "Grade 1",
        order: 1,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);

      await expect(
        useCase.execute({
          campusId: campusA,
          ids: ["grade-level-1", "grade-level-2"],
        }),
      ).rejects.toThrow(
        new NotFoundException(
          "Grade level with ID grade-level-1 not found in this campus",
        ),
      );

      // Should fail fast - only one lookup should have been made
      expect(mockGradeLevelRepository.reorder).not.toHaveBeenCalled();
    });

    it("should allow reorder when all grade levels belong to the same campus", async () => {
      const gradeLevel1 = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      const gradeLevel2 = createGradeLevel({
        id: "grade-level-2",
        campusId: campusA,
        name: "Grade 2",
        order: 2,
      });

      const gradeLevel3 = createGradeLevel({
        id: "grade-level-3",
        campusId: campusA,
        name: "Grade 3",
        order: 3,
      });

      mockGradeLevelRepository.findById.mockImplementation(async (id) => {
        if (id === "grade-level-1") return gradeLevel1;
        if (id === "grade-level-2") return gradeLevel2;
        if (id === "grade-level-3") return gradeLevel3;
        return null;
      });

      // Return reordered grade levels
      mockGradeLevelRepository.reorder.mockResolvedValue([
        gradeLevel3,
        gradeLevel1,
        gradeLevel2,
      ]);

      const result = await useCase.execute({
        campusId: campusA,
        ids: ["grade-level-3", "grade-level-1", "grade-level-2"],
      });

      expect(result).toHaveLength(3);
      expect(mockGradeLevelRepository.reorder).toHaveBeenCalledWith(campusA, [
        "grade-level-3",
        "grade-level-1",
        "grade-level-2",
      ]);
    });
  });

  describe("ID Existence Validation", () => {
    it("should throw BadRequestException when grade level does not exist", async () => {
      mockGradeLevelRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          campusId: campusA,
          ids: ["non-existent-id"],
        }),
      ).rejects.toThrow(
        new BadRequestException("Grade level(s) not found: non-existent-id"),
      );
    });

    it("should collect all missing IDs before throwing", async () => {
      // All IDs don't exist
      mockGradeLevelRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          campusId: campusA,
          ids: ["id-1", "id-2", "id-3"],
        }),
      ).rejects.toThrow(
        new BadRequestException("Grade level(s) not found: id-1, id-2, id-3"),
      );
    });
  });

  describe("Mixed Scenarios", () => {
    it("should fail campus validation before checking missing IDs", async () => {
      // First grade level exists but in different campus
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusB,
        name: "Grade 1",
        order: 1,
      });

      mockGradeLevelRepository.findById.mockImplementation(async (id) => {
        if (id === "grade-level-1") return gradeLevel;
        return null;
      });

      // Should throw NotFoundException for campus mismatch, not BadRequestException for missing
      await expect(
        useCase.execute({
          campusId: campusA,
          ids: ["grade-level-1", "non-existent-id"],
        }),
      ).rejects.toThrow(
        new NotFoundException(
          "Grade level with ID grade-level-1 not found in this campus",
        ),
      );
    });

    it("should handle empty ids array gracefully", async () => {
      mockGradeLevelRepository.reorder.mockResolvedValue([]);

      const result = await useCase.execute({
        campusId: campusA,
        ids: [],
      });

      expect(result).toEqual([]);
      expect(mockGradeLevelRepository.reorder).toHaveBeenCalledWith(
        campusA,
        [],
      );
    });
  });

  describe("Single Item Reorder", () => {
    it("should handle single grade level reorder", async () => {
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);
      mockGradeLevelRepository.reorder.mockResolvedValue([gradeLevel]);

      const result = await useCase.execute({
        campusId: campusA,
        ids: ["grade-level-1"],
      });

      expect(result).toHaveLength(1);
      expect(mockGradeLevelRepository.reorder).toHaveBeenCalledWith(campusA, [
        "grade-level-1",
      ]);
    });
  });
});
