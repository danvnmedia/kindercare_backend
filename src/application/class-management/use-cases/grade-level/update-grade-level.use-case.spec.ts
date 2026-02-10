/**
 * UpdateGradeLevelUseCase Unit Tests
 * Tests campus validation and update functionality
 */

import { NotFoundException, ConflictException } from "@nestjs/common";
import { UpdateGradeLevelUseCase } from "./update-grade-level.use-case";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import {
  createGradeLevel,
  createMockGradeLevelRepository,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

describe("UpdateGradeLevelUseCase", () => {
  let useCase: UpdateGradeLevelUseCase;
  let mockGradeLevelRepository: jest.Mocked<GradeLevelRepository>;

  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  beforeEach(() => {
    mockGradeLevelRepository = createMockGradeLevelRepository();
    useCase = new UpdateGradeLevelUseCase(mockGradeLevelRepository);
  });

  describe("Campus Validation", () => {
    it("should throw NotFoundException when grade level does not exist", async () => {
      mockGradeLevelRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("non-existent-id", campusA, { name: "Updated Name" }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute("non-existent-id", campusA, { name: "Updated Name" }),
      ).rejects.toThrow("Grade level with ID non-existent-id not found");
    });

    it("should throw NotFoundException when grade level belongs to different campus", async () => {
      // Grade level in campus B
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusB,
        name: "Grade 1",
        order: 1,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);

      // Request with campus A context
      await expect(
        useCase.execute("grade-level-1", campusA, { name: "Updated Name" }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute("grade-level-1", campusA, { name: "Updated Name" }),
      ).rejects.toThrow(
        "Grade level with ID grade-level-1 not found in this campus",
      );

      // Update should not be called
      expect(mockGradeLevelRepository.update).not.toHaveBeenCalled();
    });

    it("should allow update when grade level belongs to the same campus", async () => {
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);
      mockGradeLevelRepository.findByNameAndCampus.mockResolvedValue(null);
      mockGradeLevelRepository.update.mockImplementation(async (gl) => gl);

      const result = await useCase.execute("grade-level-1", campusA, {
        name: "Updated Name",
      });

      expect(result).toBeDefined();
      expect(result.name).toBe("Updated Name");
      expect(mockGradeLevelRepository.update).toHaveBeenCalled();
    });
  });

  describe("Name Uniqueness Validation", () => {
    it("should throw ConflictException when name already exists in campus", async () => {
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      const existingGradeLevel = createGradeLevel({
        id: "grade-level-2",
        campusId: campusA,
        name: "Grade 2",
        order: 2,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);
      mockGradeLevelRepository.findByNameAndCampus.mockResolvedValue(
        existingGradeLevel,
      );

      await expect(
        useCase.execute("grade-level-1", campusA, { name: "Grade 2" }),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute("grade-level-1", campusA, { name: "Grade 2" }),
      ).rejects.toThrow('Grade level "Grade 2" already exists');
    });

    it("should allow update when name is unchanged", async () => {
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);
      mockGradeLevelRepository.update.mockImplementation(async (gl) => gl);

      const result = await useCase.execute("grade-level-1", campusA, {
        name: "Grade 1", // Same name
      });

      expect(result).toBeDefined();
      // Should not check for name uniqueness when name is unchanged
      expect(
        mockGradeLevelRepository.findByNameAndCampus,
      ).not.toHaveBeenCalled();
    });
  });

  describe("Order Uniqueness Validation", () => {
    it("should throw ConflictException when order already exists in campus", async () => {
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      const existingGradeLevel = createGradeLevel({
        id: "grade-level-2",
        campusId: campusA,
        name: "Grade 2",
        order: 2,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);
      mockGradeLevelRepository.findByOrderAndCampus.mockResolvedValue(
        existingGradeLevel,
      );

      await expect(
        useCase.execute("grade-level-1", campusA, { order: 2 }),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute("grade-level-1", campusA, { order: 2 }),
      ).rejects.toThrow("Grade level with order 2 already exists");
    });
  });

  describe("Partial Updates", () => {
    it("should update only name when only name is provided", async () => {
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);
      mockGradeLevelRepository.findByNameAndCampus.mockResolvedValue(null);
      mockGradeLevelRepository.update.mockImplementation(async (gl) => gl);

      const result = await useCase.execute("grade-level-1", campusA, {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect(result.order).toBe(1); // Order unchanged
    });

    it("should update isArchived status", async () => {
      const gradeLevel = createGradeLevel({
        id: "grade-level-1",
        campusId: campusA,
        name: "Grade 1",
        order: 1,
      });

      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);
      mockGradeLevelRepository.update.mockImplementation(async (gl) => gl);

      const result = await useCase.execute("grade-level-1", campusA, {
        isArchived: true,
      });

      expect(result.isArchived).toBe(true);
    });
  });
});
