import { PermissionEntity, CreatePermissionData } from "./permission.entity";

describe("PermissionEntity", () => {
  describe("validateId", () => {
    it("should accept valid permission ID format", () => {
      const validIds = [
        "student.create",
        "class.read",
        "guardian.delete",
        "staff_type.list",
        "grade_level.update",
      ];

      validIds.forEach((id) => {
        expect(() => PermissionEntity.validateId(id)).not.toThrow();
      });
    });

    it("should throw for empty ID", () => {
      expect(() => PermissionEntity.validateId("")).toThrow(
        "Permission ID is required",
      );
    });

    it("should throw for null/undefined ID", () => {
      expect(() => PermissionEntity.validateId(null as any)).toThrow(
        "Permission ID is required",
      );
      expect(() => PermissionEntity.validateId(undefined as any)).toThrow(
        "Permission ID is required",
      );
    });

    it("should throw for ID without dot separator", () => {
      expect(() => PermissionEntity.validateId("studentcreate")).toThrow(
        "Permission ID must be in format: module.action",
      );
    });

    it("should throw for ID with multiple dots", () => {
      expect(() => PermissionEntity.validateId("student.create.extra")).toThrow(
        "Permission ID must be in format: module.action",
      );
    });

    it("should throw for ID with empty module", () => {
      expect(() => PermissionEntity.validateId(".create")).toThrow(
        "Permission module is required",
      );
    });

    it("should throw for ID with empty action", () => {
      expect(() => PermissionEntity.validateId("student.")).toThrow(
        "Permission action is required",
      );
    });
  });

  describe("validateModule", () => {
    it("should accept valid module names", () => {
      const validModules = [
        "student",
        "class",
        "guardian",
        "staff_type",
        "grade_level",
      ];

      validModules.forEach((module) => {
        expect(() => PermissionEntity.validateModule(module)).not.toThrow();
      });
    });

    it("should throw for empty module", () => {
      expect(() => PermissionEntity.validateModule("")).toThrow(
        "Permission module is required",
      );
    });

    it("should throw for null/undefined module", () => {
      expect(() => PermissionEntity.validateModule(null as any)).toThrow(
        "Permission module is required",
      );
      expect(() => PermissionEntity.validateModule(undefined as any)).toThrow(
        "Permission module is required",
      );
    });
  });

  describe("parseId", () => {
    it("should correctly parse valid permission ID", () => {
      const result = PermissionEntity.parseId("student.create");

      expect(result.module).toBe("student");
      expect(result.action).toBe("create");
    });

    it("should throw for invalid ID", () => {
      expect(() => PermissionEntity.parseId("invalid")).toThrow();
    });
  });

  describe("buildId", () => {
    it("should correctly build permission ID", () => {
      const result = PermissionEntity.buildId("student", "create");

      expect(result).toBe("student.create");
    });
  });

  describe("create", () => {
    it("should create a permission with valid data", () => {
      const data: CreatePermissionData = {
        id: "student.create",
        module: "student",
        description: "Create a new student",
      };

      const permission = PermissionEntity.create(data);

      expect(permission.id).toBe("student.create");
      expect(permission.module).toBe("student");
      expect(permission.description).toBe("Create a new student");
      expect(permission.createdAt).toBeInstanceOf(Date);
    });

    it("should create a permission without description", () => {
      const data: CreatePermissionData = {
        id: "student.read",
        module: "student",
      };

      const permission = PermissionEntity.create(data);

      expect(permission.id).toBe("student.read");
      expect(permission.description).toBeNull();
    });

    it("should throw for mismatched module in ID", () => {
      const data: CreatePermissionData = {
        id: "student.create",
        module: "class",
      };

      expect(() => PermissionEntity.create(data)).toThrow(
        "Permission ID module 'student' does not match provided module 'class'",
      );
    });

    it("should throw for invalid ID format", () => {
      const data: CreatePermissionData = {
        id: "invalid",
        module: "student",
      };

      expect(() => PermissionEntity.create(data)).toThrow(
        "Permission ID must be in format: module.action",
      );
    });
  });

  describe("isValidId", () => {
    it("should return true for valid IDs", () => {
      expect(PermissionEntity.isValidId("student.create")).toBe(true);
      expect(PermissionEntity.isValidId("class.read")).toBe(true);
    });

    it("should return false for invalid IDs", () => {
      expect(PermissionEntity.isValidId("")).toBe(false);
      expect(PermissionEntity.isValidId("invalid")).toBe(false);
      expect(PermissionEntity.isValidId("student.")).toBe(false);
    });
  });

  describe("getStandardPermissionsForModule", () => {
    it("should return standard CRUD permissions for a module", () => {
      const permissions =
        PermissionEntity.getStandardPermissionsForModule("student");

      expect(permissions).toContain("student.create");
      expect(permissions).toContain("student.read");
      expect(permissions).toContain("student.update");
      expect(permissions).toContain("student.delete");
      expect(permissions).toContain("student.list");
      expect(permissions).toHaveLength(5);
    });
  });
});
