import { Class } from "./class.entity";

describe("Class Entity", () => {
  const defaultProps = {
    name: "Class A1",
    campusId: "campus-1",
    gradeLevelId: "grade-level-1",
    schoolYearId: "school-year-1",
    description: "Test class",
  };

  describe("create", () => {
    it("should create a class with required fields", () => {
      const classEntity = Class.create(defaultProps);

      expect(classEntity.name).toBe("Class A1");
      expect(classEntity.campusId).toBe("campus-1");
      expect(classEntity.gradeLevelId).toBe("grade-level-1");
      expect(classEntity.schoolYearId).toBe("school-year-1");
      expect(classEntity.description).toBe("Test class");
      expect(classEntity.id).toBeDefined();
      expect(classEntity.createdAt).toBeInstanceOf(Date);
      expect(classEntity.updatedAt).toBeInstanceOf(Date);
    });

    it("should throw error for empty name", () => {
      expect(() => Class.create({ ...defaultProps, name: "" })).toThrow(
        "Class name is required",
      );
    });

    it("should throw error for missing campusId", () => {
      expect(() => Class.create({ ...defaultProps, campusId: "" })).toThrow(
        "Campus ID is required",
      );
    });

    it("should throw error for missing gradeLevelId", () => {
      expect(() =>
        Class.create({ ...defaultProps, gradeLevelId: "" }),
      ).toThrow("Grade level is required");
    });

    it("should throw error for missing schoolYearId", () => {
      expect(() =>
        Class.create({ ...defaultProps, schoolYearId: "" }),
      ).toThrow("School year is required");
    });
  });

  describe("update", () => {
    let classEntity: Class;

    beforeEach(() => {
      classEntity = Class.create(defaultProps, "class-1");
    });

    it("should update name", () => {
      classEntity.update({ name: "Updated Name" });
      expect(classEntity.name).toBe("Updated Name");
    });

    it("should update description", () => {
      classEntity.update({ description: "Updated description" });
      expect(classEntity.description).toBe("Updated description");
    });

    it("should set description to null when empty string", () => {
      classEntity.update({ description: "" });
      expect(classEntity.description).toBeNull();
    });

    it("should update gradeLevelId when provided", () => {
      classEntity.update({ gradeLevelId: "grade-level-2" });
      expect(classEntity.gradeLevelId).toBe("grade-level-2");
    });

    it("should not change gradeLevelId when not provided", () => {
      classEntity.update({ name: "New Name" });
      expect(classEntity.gradeLevelId).toBe("grade-level-1");
    });

    it("should update multiple fields at once", () => {
      classEntity.update({
        name: "New Name",
        description: "New description",
        gradeLevelId: "grade-level-3",
      });

      expect(classEntity.name).toBe("New Name");
      expect(classEntity.description).toBe("New description");
      expect(classEntity.gradeLevelId).toBe("grade-level-3");
    });

    it("should update updatedAt timestamp", () => {
      const originalUpdatedAt = classEntity.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      classEntity.update({ name: "New Name" });

      expect(classEntity.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });

    it("should throw error for empty name", () => {
      expect(() => classEntity.update({ name: "" })).toThrow(
        "Class name is required",
      );
    });
  });
});
