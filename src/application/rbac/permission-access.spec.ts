import { User } from "@/domain/user-management/user.entity";
import { Permission } from "@/domain/rbac";
import {
  getPermissionIdsForCampus,
  hasAllPermissionsInCampus,
  hasAnyPermissionInCampus,
} from "./permission-access";

const campusA = "campus-a";
const campusB = "campus-b";

function permission(id: string): Permission {
  const [module] = id.split(".");
  return {
    id,
    module,
    description: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function userWithAssignments(
  assignments: Array<{ campusId: string | null; permissionIds: string[] }>,
): User {
  return User.reconstitute(
    {
      clerkUid: "user_permissions",
      isActive: true,
      roleAssignments: assignments.map((assignment, index) => ({
        campusId: assignment.campusId,
        assignedAt: new Date("2026-01-01T00:00:00.000Z"),
        role: {
          id: `role-${index}`,
          name: `Role ${index}`,
          description: null,
          campusId: assignment.campusId,
          isSystemDefault: false,
          isSystemRole: false,
          permissions: assignment.permissionIds.map(permission),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      })),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    "user-1",
  );
}

describe("permission-access", () => {
  it("collects permissions from campus-specific and global role assignments", () => {
    const user = userWithAssignments([
      { campusId: campusA, permissionIds: ["student.read"] },
      { campusId: null, permissionIds: ["historical_records.export"] },
      { campusId: campusB, permissionIds: ["student.delete"] },
    ]);

    expect([...getPermissionIdsForCampus(user, campusA)].sort()).toEqual([
      "historical_records.export",
      "student.read",
    ]);
  });

  it("matches PermissionsGuard OR semantics for required permissions", () => {
    const user = userWithAssignments([
      { campusId: campusA, permissionIds: ["historical_records.export"] },
    ]);

    expect(
      hasAnyPermissionInCampus(user, campusA, [
        "historical_records.read",
        "historical_records.export",
      ]),
    ).toBe(true);
  });

  it("denies permissions assigned only to another campus", () => {
    const user = userWithAssignments([
      { campusId: campusB, permissionIds: ["historical_records.export"] },
    ]);

    expect(
      hasAnyPermissionInCampus(user, campusA, ["historical_records.export"]),
    ).toBe(false);
  });

  it("requires every permission for an explicit all-permissions policy", () => {
    const user = userWithAssignments([
      {
        campusId: campusA,
        permissionIds: [
          "medication_request.read",
          "medication_administration.read",
        ],
      },
    ]);

    expect(
      hasAllPermissionsInCampus(user, campusA, [
        "medication_request.read",
        "medication_administration.read",
      ]),
    ).toBe(true);
    expect(
      hasAllPermissionsInCampus(user, campusA, [
        "medication_request.read",
        "student_health.read",
      ]),
    ).toBe(false);
  });
});
