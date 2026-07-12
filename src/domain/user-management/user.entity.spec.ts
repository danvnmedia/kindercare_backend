import { Role } from "./role.entity";
import { User, UserRoleAssignment } from "./user.entity";

describe("User", () => {
  const createRole = (isSystemRole: boolean): Role => ({
    id: "test-role",
    name: "Test Role",
    description: null,
    campusId: null,
    isSystemDefault: false,
    isSystemRole,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createUser = (
    roleAssignments: UserRoleAssignment[] | undefined,
  ): User =>
    User.reconstitute(
      {
        clerkUid: "user_test12345",
        isActive: true,
        roleAssignments,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      "user-id",
    );

  const createAssignment = (
    isSystemRole: boolean,
    campusId: string | null,
  ): UserRoleAssignment => ({
    role: createRole(isSystemRole),
    campusId,
    assignedAt: new Date(),
  });

  describe("hasSystemRole", () => {
    it("returns true for a globally assigned system role", () => {
      const user = createUser([createAssignment(true, null)]);

      expect(user.hasSystemRole()).toBe(true);
    });

    it("returns false for a campus-scoped system role", () => {
      const user = createUser([
        createAssignment(true, "550e8400-e29b-41d4-a716-446655440000"),
      ]);

      expect(user.hasSystemRole()).toBe(false);
    });

    it("returns false for a globally assigned non-system role", () => {
      const user = createUser([createAssignment(false, null)]);

      expect(user.hasSystemRole()).toBe(false);
    });

    it("returns false without role assignments", () => {
      const user = createUser(undefined);

      expect(user.hasSystemRole()).toBe(false);
    });
  });
});
