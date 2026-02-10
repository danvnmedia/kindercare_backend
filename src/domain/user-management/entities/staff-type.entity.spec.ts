import { StaffType } from "./staff-type.entity";

describe("StaffType Entity", () => {
  const validCampusId = "123e4567-e89b-12d3-a456-426614174000";

  describe("create", () => {
    it("should create a staff type with required fields", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Teacher",
        order: 1,
      });

      expect(staffType.campusId).toBe(validCampusId);
      expect(staffType.name).toBe("Teacher");
      expect(staffType.description).toBeNull();
      expect(staffType.defaultRoleId).toBeNull();
      expect(staffType.isActive).toBe(true);
      expect(staffType.order).toBe(1);
      expect(staffType.id).toBeDefined();
      expect(staffType.createdAt).toBeInstanceOf(Date);
      expect(staffType.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a staff type with all fields", () => {
      const roleId = "role-123";
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Principal",
        description: "School principal role",
        defaultRoleId: roleId,
        isActive: false,
        order: 2,
      });

      expect(staffType.name).toBe("Principal");
      expect(staffType.description).toBe("School principal role");
      expect(staffType.defaultRoleId).toBe(roleId);
      expect(staffType.isActive).toBe(false);
      expect(staffType.order).toBe(2);
    });

    it("should create a staff type with provided id", () => {
      const id = "staff-type-123";
      const staffType = StaffType.create(
        { campusId: validCampusId, name: "Nurse", order: 1 },
        id,
      );

      expect(staffType.id).toBe(id);
    });

    it("should trim name and description", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "  Teacher  ",
        description: "  Teacher description  ",
        order: 1,
      });

      expect(staffType.name).toBe("Teacher");
      expect(staffType.description).toBe("Teacher description");
    });

    it("should throw error for missing campusId", () => {
      expect(() =>
        StaffType.create({ campusId: "", name: "Teacher", order: 1 }),
      ).toThrow("Campus ID is required for staff type");
    });

    it("should throw error for empty name", () => {
      expect(() =>
        StaffType.create({ campusId: validCampusId, name: "", order: 1 }),
      ).toThrow("Staff type name is required");
    });

    it("should throw error for whitespace-only name", () => {
      expect(() =>
        StaffType.create({ campusId: validCampusId, name: "   ", order: 1 }),
      ).toThrow("Staff type name is required");
    });

    it("should throw error for name exceeding 100 characters", () => {
      const longName = "a".repeat(101);
      expect(() =>
        StaffType.create({ campusId: validCampusId, name: longName, order: 1 }),
      ).toThrow("Staff type name must be at most 100 characters");
    });

    it("should accept name with exactly 100 characters", () => {
      const maxName = "a".repeat(100);
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: maxName,
        order: 1,
      });

      expect(staffType.name).toBe(maxName);
    });

    it("should throw error for negative order", () => {
      expect(() =>
        StaffType.create({
          campusId: validCampusId,
          name: "Teacher",
          order: -1,
        }),
      ).toThrow("Order must be a non-negative number");
    });

    it("should accept order of 0", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Teacher",
        order: 0,
      });

      expect(staffType.order).toBe(0);
    });
  });

  describe("update", () => {
    let staffType: StaffType;

    beforeEach(() => {
      staffType = StaffType.create({
        campusId: validCampusId,
        name: "Original Name",
        description: "Original Description",
        defaultRoleId: "role-original",
        order: 1,
      });
    });

    it("should update name", () => {
      staffType.update({ name: "Updated Name" });

      expect(staffType.name).toBe("Updated Name");
    });

    it("should update description", () => {
      staffType.update({ description: "New Description" });

      expect(staffType.description).toBe("New Description");
    });

    it("should set description to null", () => {
      staffType.update({ description: null });

      expect(staffType.description).toBeNull();
    });

    it("should update defaultRoleId", () => {
      staffType.update({ defaultRoleId: "new-role-id" });

      expect(staffType.defaultRoleId).toBe("new-role-id");
    });

    it("should set defaultRoleId to null", () => {
      staffType.update({ defaultRoleId: null });

      expect(staffType.defaultRoleId).toBeNull();
    });

    it("should update isActive", () => {
      staffType.update({ isActive: false });

      expect(staffType.isActive).toBe(false);
    });

    it("should update multiple fields at once", () => {
      staffType.update({
        name: "New Name",
        description: "New Description",
        isActive: false,
      });

      expect(staffType.name).toBe("New Name");
      expect(staffType.description).toBe("New Description");
      expect(staffType.isActive).toBe(false);
    });

    it("should update updatedAt timestamp", () => {
      const originalUpdatedAt = staffType.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staffType.update({ name: "New Name" });

      expect(staffType.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });

    it("should throw error for empty name", () => {
      expect(() => staffType.update({ name: "" })).toThrow(
        "Staff type name is required",
      );
    });

    it("should throw error for name exceeding 100 characters", () => {
      const longName = "a".repeat(101);
      expect(() => staffType.update({ name: longName })).toThrow(
        "Staff type name must be at most 100 characters",
      );
    });

    it("should trim name and description when updating", () => {
      staffType.update({
        name: "  Trimmed Name  ",
        description: "  Trimmed Description  ",
      });

      expect(staffType.name).toBe("Trimmed Name");
      expect(staffType.description).toBe("Trimmed Description");
    });

    it("should update order", () => {
      staffType.update({ order: 5 });

      expect(staffType.order).toBe(5);
    });

    it("should throw error for negative order when updating", () => {
      expect(() => staffType.update({ order: -1 })).toThrow(
        "Order must be a non-negative number",
      );
    });
  });

  describe("updateOrder", () => {
    let staffType: StaffType;

    beforeEach(() => {
      staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        order: 1,
      });
    });

    it("should update order", () => {
      staffType.updateOrder(5);

      expect(staffType.order).toBe(5);
    });

    it("should allow order of 0", () => {
      staffType.updateOrder(0);

      expect(staffType.order).toBe(0);
    });

    it("should throw error for negative order", () => {
      expect(() => staffType.updateOrder(-1)).toThrow(
        "Order must be a non-negative number",
      );
    });

    it("should update updatedAt timestamp", () => {
      const originalUpdatedAt = staffType.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staffType.updateOrder(10);

      expect(staffType.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("activate", () => {
    it("should set isActive to true", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        isActive: false,
        order: 1,
      });

      staffType.activate();

      expect(staffType.isActive).toBe(true);
    });

    it("should not change if already active", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        isActive: true,
        order: 1,
      });
      const originalUpdatedAt = staffType.updatedAt;

      staffType.activate();

      expect(staffType.isActive).toBe(true);
      expect(staffType.updatedAt).toEqual(originalUpdatedAt);
    });
  });

  describe("deactivate", () => {
    it("should set isActive to false", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        isActive: true,
        order: 1,
      });

      staffType.deactivate();

      expect(staffType.isActive).toBe(false);
    });

    it("should not change if already inactive", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        isActive: false,
        order: 1,
      });
      const originalUpdatedAt = staffType.updatedAt;

      staffType.deactivate();

      expect(staffType.isActive).toBe(false);
      expect(staffType.updatedAt).toEqual(originalUpdatedAt);
    });
  });

  describe("setDefaultRole", () => {
    it("should set defaultRoleId", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        order: 1,
      });

      staffType.setDefaultRole("new-role-id");

      expect(staffType.defaultRoleId).toBe("new-role-id");
    });

    it("should clear defaultRoleId when set to null", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        defaultRoleId: "existing-role",
        order: 1,
      });

      staffType.setDefaultRole(null);

      expect(staffType.defaultRoleId).toBeNull();
    });

    it("should update updatedAt timestamp", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        order: 1,
      });
      const originalUpdatedAt = staffType.updatedAt;

      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);

      staffType.setDefaultRole("role-id");

      expect(staffType.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );

      jest.useRealTimers();
    });
  });

  describe("hasDefaultRole", () => {
    it("should return true when defaultRoleId is set", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        defaultRoleId: "role-id",
        order: 1,
      });

      expect(staffType.hasDefaultRole()).toBe(true);
    });

    it("should return false when defaultRoleId is null", () => {
      const staffType = StaffType.create({
        campusId: validCampusId,
        name: "Test",
        order: 1,
      });

      expect(staffType.hasDefaultRole()).toBe(false);
    });
  });
});
