import { userHasPostPermission } from "./post-permission.helper";
import { Role } from "@/domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";

const role = (permissions: string[]): Role =>
  ({
    id: "role-1",
    name: "Role",
    description: null,
    campusId: null,
    isSystemDefault: false,
    isSystemRole: false,
    permissions: permissions.map((id) => ({ id })),
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as Role;

const user = (roles: Role[], isSystemRole = false): User =>
  ({
    hasSystemRole: () => isSystemRole,
    getRolesForCampus: () => roles,
  }) as unknown as User;

describe("userHasPostPermission", () => {
  it("allows system roles", () => {
    expect(
      userHasPostPermission(user([], true), "campus-1", "post.review"),
    ).toBe(true);
  });

  it("allows direct post permission", () => {
    expect(
      userHasPostPermission(
        user([role(["post.review"])]),
        "campus-1",
        "post.review",
      ),
    ).toBe(true);
  });

  it("allows post.manage as an implied permission", () => {
    expect(
      userHasPostPermission(
        user([role(["post.manage"])]),
        "campus-1",
        "post.review",
      ),
    ).toBe(true);
  });

  it("rejects missing permission", () => {
    expect(
      userHasPostPermission(
        user([role(["post.read"])]),
        "campus-1",
        "post.review",
      ),
    ).toBe(false);
  });
});
