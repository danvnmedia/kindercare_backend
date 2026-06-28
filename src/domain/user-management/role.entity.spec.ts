import { Role, RoleEntity } from "./role.entity";
import { Permission } from "../rbac";

describe("RoleEntity", () => {
  const mockPermission = (id: string, module: string): Permission => ({
    id,
    module,
    description: `Test permission for ${id}`,
    createdAt: new Date(),
  });

  const mockRole = (overrides: Partial<Role> = {}): Role => ({
    id: "test_role",
    name: "Test Role",
    description: "A test role",
    campusId: null,
    isSystemDefault: false,
    isSystemRole: false,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("validateName", () => {
    it("should accept valid role names", () => {
      expect(() => RoleEntity.validateName("Admin")).not.toThrow();
      expect(() => RoleEntity.validateName("Campus Manager")).not.toThrow();
      expect(() => RoleEntity.validateName("AB")).not.toThrow();
    });

    it("should throw for empty name", () => {
      expect(() => RoleEntity.validateName("")).toThrow(
        "Role name cannot be empty",
      );
    });

    it("should throw for whitespace-only name", () => {
      expect(() => RoleEntity.validateName("   ")).toThrow(
        "Role name cannot be empty",
      );
    });

    it("should throw for name shorter than 2 characters", () => {
      expect(() => RoleEntity.validateName("A")).toThrow(
        "Role name must be at least 2 characters",
      );
    });
  });

  describe("validateCampusId", () => {
    it("should accept null for system-wide roles", () => {
      expect(() => RoleEntity.validateCampusId(null)).not.toThrow();
    });

    it("should accept valid UUID", () => {
      const validUUID = "550e8400-e29b-41d4-a716-446655440000";
      expect(() => RoleEntity.validateCampusId(validUUID)).not.toThrow();
    });

    it("should throw for invalid UUID format", () => {
      expect(() => RoleEntity.validateCampusId("invalid-uuid")).toThrow(
        "Campus ID must be a valid UUID",
      );
      expect(() => RoleEntity.validateCampusId("123")).toThrow(
        "Campus ID must be a valid UUID",
      );
    });
  });

  describe("hasPermission", () => {
    it("should return true when role has the permission", () => {
      const role = mockRole({
        permissions: [
          mockPermission("student.create", "student"),
          mockPermission("student.read", "student"),
        ],
      });

      expect(RoleEntity.hasPermission(role, "student", "create")).toBe(true);
      expect(RoleEntity.hasPermission(role, "student", "read")).toBe(true);
    });

    it("should return false when role does not have the permission", () => {
      const role = mockRole({
        permissions: [mockPermission("student.create", "student")],
      });

      expect(RoleEntity.hasPermission(role, "student", "delete")).toBe(false);
      expect(RoleEntity.hasPermission(role, "class", "create")).toBe(false);
    });

    it("should return false for empty permissions array", () => {
      const role = mockRole({ permissions: [] });

      expect(RoleEntity.hasPermission(role, "student", "create")).toBe(false);
    });

    it("should return false for null permissions", () => {
      const role = mockRole({ permissions: null as any });

      expect(RoleEntity.hasPermission(role, "student", "create")).toBe(false);
    });
  });

  describe("hasPermissionById", () => {
    it("should return true when role has the permission by ID", () => {
      const role = mockRole({
        permissions: [
          mockPermission("student.create", "student"),
          mockPermission("class.read", "class"),
        ],
      });

      expect(RoleEntity.hasPermissionById(role, "student.create")).toBe(true);
      expect(RoleEntity.hasPermissionById(role, "class.read")).toBe(true);
    });

    it("should return false when role does not have the permission ID", () => {
      const role = mockRole({
        permissions: [mockPermission("student.create", "student")],
      });

      expect(RoleEntity.hasPermissionById(role, "student.delete")).toBe(false);
    });
  });

  describe("isSystemDefault", () => {
    it("should return true for system default roles", () => {
      const role = mockRole({ isSystemDefault: true });

      expect(RoleEntity.isSystemDefault(role)).toBe(true);
    });

    it("should return false for non-system default roles", () => {
      const role = mockRole({ isSystemDefault: false });

      expect(RoleEntity.isSystemDefault(role)).toBe(false);
    });
  });

  describe("isSystemRole", () => {
    it("should return true for system roles", () => {
      const role = mockRole({ isSystemRole: true });

      expect(RoleEntity.isSystemRole(role)).toBe(true);
    });

    it("should return false for non-system roles", () => {
      const role = mockRole({ isSystemRole: false });

      expect(RoleEntity.isSystemRole(role)).toBe(false);
    });

    it("should return false by default", () => {
      const role = mockRole({});

      expect(RoleEntity.isSystemRole(role)).toBe(false);
    });
  });

  describe("isCampusScoped", () => {
    it("should return true for campus-scoped roles", () => {
      const role = mockRole({
        campusId: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(RoleEntity.isCampusScoped(role)).toBe(true);
    });

    it("should return false for system-wide roles", () => {
      const role = mockRole({ campusId: null });

      expect(RoleEntity.isCampusScoped(role)).toBe(false);
    });
  });

  describe("getPermissionIds", () => {
    it("should return array of permission IDs", () => {
      const role = mockRole({
        permissions: [
          mockPermission("student.create", "student"),
          mockPermission("student.read", "student"),
          mockPermission("class.read", "class"),
        ],
      });

      const ids = RoleEntity.getPermissionIds(role);

      expect(ids).toContain("student.create");
      expect(ids).toContain("student.read");
      expect(ids).toContain("class.read");
      expect(ids).toHaveLength(3);
    });

    it("should return empty array for no permissions", () => {
      const role = mockRole({ permissions: [] });

      expect(RoleEntity.getPermissionIds(role)).toEqual([]);
    });
  });

  describe("getPermissionsByModule", () => {
    it("should group permissions by module", () => {
      const role = mockRole({
        permissions: [
          mockPermission("student.create", "student"),
          mockPermission("student.read", "student"),
          mockPermission("class.read", "class"),
        ],
      });

      const grouped = RoleEntity.getPermissionsByModule(role);

      expect(grouped.student).toHaveLength(2);
      expect(grouped.class).toHaveLength(1);
      expect(grouped.student.map((p) => p.id)).toContain("student.create");
      expect(grouped.student.map((p) => p.id)).toContain("student.read");
      expect(grouped.class.map((p) => p.id)).toContain("class.read");
    });

    it("should return empty object for no permissions", () => {
      const role = mockRole({ permissions: [] });

      expect(RoleEntity.getPermissionsByModule(role)).toEqual({});
    });
  });
});
