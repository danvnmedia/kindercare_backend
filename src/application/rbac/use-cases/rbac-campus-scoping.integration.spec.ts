/**
 * RBAC Campus Scoping Integration Tests
 * Tests that role-based access control properly respects campus boundaries
 */

import {
  createUser,
  createRole,
  createPermission,
  createRoleAssignment,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";
import { User, UserRoleAssignment } from "@/domain/user-management/user.entity";
import { Role, RoleEntity } from "@/domain/user-management/role.entity";
import {
  hasCampusAccess,
  isGlobalAdmin,
} from "@/infra/http/context/campus-context";

describe("RBAC Campus Scoping Integration Tests", () => {
  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  describe("User.getRolesForCampus", () => {
    it("should return only roles applicable to the specified campus", () => {
      const roleInCampusA = createRole({
        id: "role-a",
        name: "Campus A Staff",
        campusId: campusA,
      });

      const roleInCampusB = createRole({
        id: "role-b",
        name: "Campus B Staff",
        campusId: campusB,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [
          createRoleAssignment(roleInCampusA, campusA),
          createRoleAssignment(roleInCampusB, campusB),
        ],
      });

      // Get roles for campus A
      const rolesForCampusA = user.getRolesForCampus(campusA);
      expect(rolesForCampusA).toHaveLength(1);
      expect(rolesForCampusA[0].id).toBe("role-a");

      // Get roles for campus B
      const rolesForCampusB = user.getRolesForCampus(campusB);
      expect(rolesForCampusB).toHaveLength(1);
      expect(rolesForCampusB[0].id).toBe("role-b");
    });

    it("should include global roles (null campusId) for any campus", () => {
      const globalRole = createRole({
        id: "global-role",
        name: "Super Admin",
        campusId: null, // Global role
      });

      const campusSpecificRole = createRole({
        id: "campus-role",
        name: "Campus Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [
          createRoleAssignment(globalRole, null), // Global assignment
          createRoleAssignment(campusSpecificRole, campusA),
        ],
      });

      // Global role should appear for campus A
      const rolesForCampusA = user.getRolesForCampus(campusA);
      expect(rolesForCampusA).toHaveLength(2);
      expect(rolesForCampusA.map((r) => r.id)).toContain("global-role");
      expect(rolesForCampusA.map((r) => r.id)).toContain("campus-role");

      // Global role should also appear for campus B
      const rolesForCampusB = user.getRolesForCampus(campusB);
      expect(rolesForCampusB).toHaveLength(1);
      expect(rolesForCampusB[0].id).toBe("global-role");
    });

    it("should return empty array when user has no roles for the campus", () => {
      const roleInCampusA = createRole({
        id: "role-a",
        name: "Campus A Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(roleInCampusA, campusA)],
      });

      // User has no roles in campus B
      const rolesForCampusB = user.getRolesForCampus(campusB);
      expect(rolesForCampusB).toHaveLength(0);
    });
  });

  describe("User.hasRoleInCampus", () => {
    it("should return true when user has the role in the specified campus", () => {
      const role = createRole({
        id: "role-1",
        name: "Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, campusA)],
      });

      expect(user.hasRoleInCampus("role-1", campusA)).toBe(true);
    });

    it("should return false when user has the role but in different campus", () => {
      const role = createRole({
        id: "role-1",
        name: "Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, campusA)],
      });

      // User does not have this role in campus B
      expect(user.hasRoleInCampus("role-1", campusB)).toBe(false);
    });

    it("should return true for global role assignment regardless of campus", () => {
      const globalRole = createRole({
        id: "admin-role",
        name: "Super Admin",
        campusId: null,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(globalRole, null)], // Global assignment
      });

      // Global role applies to any campus
      expect(user.hasRoleInCampus("admin-role", campusA)).toBe(true);
      expect(user.hasRoleInCampus("admin-role", campusB)).toBe(true);
    });
  });

  describe("User.getGlobalRoles", () => {
    it("should return only globally assigned roles", () => {
      const globalRole = createRole({
        id: "global-role",
        name: "Super Admin",
        campusId: null,
      });

      const campusRole = createRole({
        id: "campus-role",
        name: "Campus Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [
          createRoleAssignment(globalRole, null),
          createRoleAssignment(campusRole, campusA),
        ],
      });

      const globalRoles = user.getGlobalRoles();
      expect(globalRoles).toHaveLength(1);
      expect(globalRoles[0].id).toBe("global-role");
    });

    it("should return empty array when user has no global roles", () => {
      const campusRole = createRole({
        id: "campus-role",
        name: "Campus Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(campusRole, campusA)],
      });

      const globalRoles = user.getGlobalRoles();
      expect(globalRoles).toHaveLength(0);
    });
  });

  describe("hasCampusAccess", () => {
    it("should return true when user has any role in the campus", () => {
      const role = createRole({
        id: "role-1",
        name: "Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, campusA)],
      });

      expect(hasCampusAccess(user, campusA)).toBe(true);
    });

    it("should return false when user has no roles in the campus", () => {
      const role = createRole({
        id: "role-1",
        name: "Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(role, campusA)],
      });

      // User has no roles in campus B
      expect(hasCampusAccess(user, campusB)).toBe(false);
    });

    it("should return true when user has global role", () => {
      const globalRole = createRole({
        id: "admin-role",
        name: "Super Admin",
        campusId: null,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(globalRole, null)],
      });

      // Global role grants access to any campus
      expect(hasCampusAccess(user, campusA)).toBe(true);
      expect(hasCampusAccess(user, campusB)).toBe(true);
    });

    it("should return true when campusId is null (no specific campus required)", () => {
      const user = createUser({
        id: "user-1",
        roleAssignments: [],
      });

      // No specific campus required
      expect(hasCampusAccess(user, null)).toBe(true);
    });
  });

  describe("isGlobalAdmin", () => {
    it("should return true for user with isSystemRole=true global role", () => {
      const adminRole = createRole({
        id: "admin-role",
        name: "Admin",
        campusId: null,
        isSystemRole: true, // This is what grants global admin bypass
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(adminRole, null)],
      });

      expect(isGlobalAdmin(user)).toBe(true);
    });

    it("should NOT grant admin based on role name alone (security fix)", () => {
      // SECURITY: Role names like "Super Admin" or "ADMINISTRATOR" should NOT
      // grant admin bypass - only isSystemRole=true should grant it
      const fakeAdminRole = createRole({
        id: "fake-admin-role",
        name: "Super Administrator", // Name has "admin" but NOT a system role
        campusId: null,
        isSystemRole: false,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(fakeAdminRole, null)],
      });

      // Should NOT be recognized as global admin
      expect(isGlobalAdmin(user)).toBe(false);
    });

    it("should return false for user with campus-specific admin role", () => {
      const campusAdminRole = createRole({
        id: "campus-admin",
        name: "Campus Admin",
        campusId: campusA, // Campus-specific, not global
        isSystemRole: false,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(campusAdminRole, campusA)],
      });

      // Campus admin is not a global admin
      expect(isGlobalAdmin(user)).toBe(false);
    });

    it("should return false for regular staff with global role", () => {
      const staffRole = createRole({
        id: "staff-role",
        name: "Teacher",
        campusId: null,
        isSystemRole: false,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [createRoleAssignment(staffRole, null)],
      });

      expect(isGlobalAdmin(user)).toBe(false);
    });

    it("should return false for isSystemRole=true but campus-scoped role", () => {
      // isSystemRole only grants bypass when combined with global scope (campusId=null)
      const campusScopedSystemRole = createRole({
        id: "weird-role",
        name: "Weird Role",
        campusId: campusA, // Campus-specific
        isSystemRole: true, // Even though marked as system role
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [
          createRoleAssignment(campusScopedSystemRole, campusA),
        ],
      });

      // Should NOT be global admin because role is campus-scoped
      expect(isGlobalAdmin(user)).toBe(false);
    });
  });

  describe("Role.isCampusScoped", () => {
    it("should return true for campus-specific roles", () => {
      const campusRole = createRole({
        id: "role-1",
        name: "Campus Staff",
        campusId: campusA,
      });

      expect(RoleEntity.isCampusScoped(campusRole)).toBe(true);
    });

    it("should return false for global roles", () => {
      const globalRole = createRole({
        id: "role-1",
        name: "Global Staff",
        campusId: null,
      });

      expect(RoleEntity.isCampusScoped(globalRole)).toBe(false);
    });
  });

  describe("Role Permissions with Campus Context", () => {
    it("should check permissions for roles in the campus context", () => {
      const studentReadPermission = createPermission({
        id: "student.read",
        module: "student",
      });

      const studentCreatePermission = createPermission({
        id: "student.create",
        module: "student",
      });

      const campusRole = createRole({
        id: "role-1",
        name: "Teacher",
        campusId: campusA,
        permissions: [studentReadPermission],
      });

      const globalRole = createRole({
        id: "role-2",
        name: "Admin",
        campusId: null,
        permissions: [studentReadPermission, studentCreatePermission],
      });

      // Check permission existence
      expect(RoleEntity.hasPermission(campusRole, "student", "read")).toBe(
        true,
      );
      expect(RoleEntity.hasPermission(campusRole, "student", "create")).toBe(
        false,
      );

      expect(RoleEntity.hasPermission(globalRole, "student", "read")).toBe(
        true,
      );
      expect(RoleEntity.hasPermission(globalRole, "student", "create")).toBe(
        true,
      );
    });

    it("should aggregate permissions from multiple roles for a campus", () => {
      const readPermission = createPermission({
        id: "student.read",
        module: "student",
      });

      const writePermission = createPermission({
        id: "student.create",
        module: "student",
      });

      const readerRole = createRole({
        id: "reader-role",
        name: "Reader",
        campusId: campusA,
        permissions: [readPermission],
      });

      const creatorRole = createRole({
        id: "creator-role",
        name: "Creator",
        campusId: campusA,
        permissions: [writePermission],
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [
          createRoleAssignment(readerRole, campusA),
          createRoleAssignment(creatorRole, campusA),
        ],
      });

      // Get all roles for campus A
      const rolesForCampusA = user.getRolesForCampus(campusA);
      expect(rolesForCampusA).toHaveLength(2);

      // Collect all permissions from roles
      const allPermissions = rolesForCampusA.flatMap((role) =>
        RoleEntity.getPermissionIds(role),
      );
      expect(allPermissions).toContain("student.read");
      expect(allPermissions).toContain("student.create");
    });
  });

  describe("Multi-Campus User Scenarios", () => {
    it("should handle user with different roles in different campuses", () => {
      const teacherPermission = createPermission({
        id: "student.read",
        module: "student",
      });

      const adminPermission = createPermission({
        id: "student.manage",
        module: "student",
      });

      const teacherRole = createRole({
        id: "teacher-role",
        name: "Teacher",
        campusId: campusA,
        permissions: [teacherPermission],
      });

      const adminRole = createRole({
        id: "admin-role",
        name: "Campus Admin",
        campusId: campusB,
        permissions: [adminPermission],
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [
          createRoleAssignment(teacherRole, campusA),
          createRoleAssignment(adminRole, campusB),
        ],
      });

      // In campus A, user is a teacher
      const rolesInA = user.getRolesForCampus(campusA);
      expect(rolesInA).toHaveLength(1);
      expect(rolesInA[0].name).toBe("Teacher");
      expect(RoleEntity.hasPermission(rolesInA[0], "student", "read")).toBe(
        true,
      );
      expect(RoleEntity.hasPermission(rolesInA[0], "student", "manage")).toBe(
        false,
      );

      // In campus B, user is an admin
      const rolesInB = user.getRolesForCampus(campusB);
      expect(rolesInB).toHaveLength(1);
      expect(rolesInB[0].name).toBe("Campus Admin");
      expect(RoleEntity.hasPermission(rolesInB[0], "student", "manage")).toBe(
        true,
      );
    });

    it("should handle user with both global and campus-specific roles", () => {
      const globalRole = createRole({
        id: "global-role",
        name: "System Auditor",
        campusId: null,
      });

      const campusRole = createRole({
        id: "campus-role",
        name: "Campus Staff",
        campusId: campusA,
      });

      const user = createUser({
        id: "user-1",
        roleAssignments: [
          createRoleAssignment(globalRole, null),
          createRoleAssignment(campusRole, campusA),
        ],
      });

      // In campus A, user has both roles
      const rolesInA = user.getRolesForCampus(campusA);
      expect(rolesInA).toHaveLength(2);

      // In campus B, user only has the global role
      const rolesInB = user.getRolesForCampus(campusB);
      expect(rolesInB).toHaveLength(1);
      expect(rolesInB[0].name).toBe("System Auditor");
    });
  });
});
