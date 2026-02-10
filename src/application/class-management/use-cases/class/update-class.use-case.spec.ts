import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { UpdateClassUseCase } from "./update-class.use-case";
import { ClassRepository } from "../../ports/class.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import {
  createClass,
  createGradeLevel,
  createMockClassRepository,
  createMockGradeLevelRepository,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

describe("UpdateClassUseCase", () => {
  let useCase: UpdateClassUseCase;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockGradeLevelRepository: jest.Mocked<GradeLevelRepository>;

  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  beforeEach(() => {
    mockClassRepository = createMockClassRepository();
    mockGradeLevelRepository = createMockGradeLevelRepository();
    useCase = new UpdateClassUseCase(
      mockClassRepository,
      mockGradeLevelRepository,
    );
  });

  describe("Basic Updates", () => {
    it("should update class name successfully", async () => {
      const existingClass = createClass({
        id: "class-1",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
      });

      mockClassRepository.findById.mockResolvedValue(existingClass);
      mockClassRepository.findByNameInContextAndCampus.mockResolvedValue(null);
      mockClassRepository.update.mockImplementation(async (c) => c);

      const result = await useCase.execute("class-1", { name: "Class B1" });

      expect(result.name).toBe("Class B1");
      expect(mockClassRepository.update).toHaveBeenCalled();
    });

    it("should throw NotFoundException when class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("non-existent", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("Grade Level Update", () => {
    it("should update grade level successfully", async () => {
      const existingClass = createClass({
        id: "class-1",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
      });

      const newGradeLevel = createGradeLevel({
        id: "grade-level-2",
        campusId: campusA,
        name: "Grade 2",
        order: 2,
      });

      mockClassRepository.findById.mockResolvedValue(existingClass);
      mockGradeLevelRepository.findById.mockResolvedValue(newGradeLevel);
      mockClassRepository.findByNameInContextAndCampus.mockResolvedValue(null);
      mockClassRepository.update.mockImplementation(async (c) => c);

      const result = await useCase.execute("class-1", {
        gradeLevelId: "grade-level-2",
      });

      expect(result.gradeLevelId).toBe("grade-level-2");
      expect(mockGradeLevelRepository.findById).toHaveBeenCalledWith(
        "grade-level-2",
      );
    });

    it("should throw NotFoundException for non-existent grade level", async () => {
      const existingClass = createClass({
        id: "class-1",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
      });

      mockClassRepository.findById.mockResolvedValue(existingClass);
      mockGradeLevelRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("class-1", { gradeLevelId: "non-existent" }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute("class-1", { gradeLevelId: "non-existent" }),
      ).rejects.toThrow("Grade level with ID non-existent not found");
    });

    it("should throw BadRequestException for cross-campus grade level", async () => {
      const existingClass = createClass({
        id: "class-1",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
      });

      const crossCampusGradeLevel = createGradeLevel({
        id: "grade-level-b",
        campusId: campusB,
        name: "Grade B",
        order: 1,
      });

      mockClassRepository.findById.mockResolvedValue(existingClass);
      mockGradeLevelRepository.findById.mockResolvedValue(
        crossCampusGradeLevel,
      );

      await expect(
        useCase.execute("class-1", { gradeLevelId: "grade-level-b" }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute("class-1", { gradeLevelId: "grade-level-b" }),
      ).rejects.toThrow("Grade level does not belong to the specified campus");
    });

    it("should skip grade level validation when gradeLevelId is unchanged", async () => {
      const existingClass = createClass({
        id: "class-1",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
      });

      mockClassRepository.findById.mockResolvedValue(existingClass);
      mockClassRepository.update.mockImplementation(async (c) => c);

      await useCase.execute("class-1", {
        gradeLevelId: "grade-level-1",
      });

      expect(mockGradeLevelRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe("Uniqueness Validation", () => {
    it("should check uniqueness when grade level changes", async () => {
      const existingClass = createClass({
        id: "class-1",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
      });

      const newGradeLevel = createGradeLevel({
        id: "grade-level-2",
        campusId: campusA,
        name: "Grade 2",
        order: 2,
      });

      const conflictingClass = createClass({
        id: "class-2",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-2",
        schoolYearId: "school-year-1",
      });

      mockClassRepository.findById.mockResolvedValue(existingClass);
      mockGradeLevelRepository.findById.mockResolvedValue(newGradeLevel);
      mockClassRepository.findByNameInContextAndCampus.mockResolvedValue(
        conflictingClass,
      );

      await expect(
        useCase.execute("class-1", { gradeLevelId: "grade-level-2" }),
      ).rejects.toThrow(ConflictException);

      expect(
        mockClassRepository.findByNameInContextAndCampus,
      ).toHaveBeenCalledWith(
        "Class A1",
        campusA,
        "school-year-1",
        "grade-level-2",
      );
    });

    it("should check uniqueness when both name and grade level change", async () => {
      const existingClass = createClass({
        id: "class-1",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
      });

      const newGradeLevel = createGradeLevel({
        id: "grade-level-2",
        campusId: campusA,
        name: "Grade 2",
        order: 2,
      });

      mockClassRepository.findById.mockResolvedValue(existingClass);
      mockGradeLevelRepository.findById.mockResolvedValue(newGradeLevel);
      mockClassRepository.findByNameInContextAndCampus.mockResolvedValue(null);
      mockClassRepository.update.mockImplementation(async (c) => c);

      const result = await useCase.execute("class-1", {
        name: "Class B1",
        gradeLevelId: "grade-level-2",
      });

      expect(result.name).toBe("Class B1");
      expect(result.gradeLevelId).toBe("grade-level-2");
      expect(
        mockClassRepository.findByNameInContextAndCampus,
      ).toHaveBeenCalledWith(
        "Class B1",
        campusA,
        "school-year-1",
        "grade-level-2",
      );
    });

    it("should not check uniqueness when neither name nor grade level changes", async () => {
      const existingClass = createClass({
        id: "class-1",
        campusId: campusA,
        name: "Class A1",
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
      });

      mockClassRepository.findById.mockResolvedValue(existingClass);
      mockClassRepository.update.mockImplementation(async (c) => c);

      await useCase.execute("class-1", { description: "Updated description" });

      expect(
        mockClassRepository.findByNameInContextAndCampus,
      ).not.toHaveBeenCalled();
    });
  });
});
