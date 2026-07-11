import {
  userCanManagePost,
  userHasPostPermission,
} from "./post-permission.helper";
import { Role } from "@/domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";

const role = (permissions: string[], overrides: Partial<Role> = {}): Role =>
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
    ...overrides,
  }) as Role;

const user = (
  roles: Role[],
  hasGlobalSystemRole = false,
  id = "user-1",
): User =>
  ({
    id,
    getGlobalRoles: () =>
      hasGlobalSystemRole ? [role([], { isSystemRole: true })] : [],
    getRolesForCampus: () => roles,
  }) as unknown as User;

describe("userHasPostPermission", () => {
  it("allows globally assigned system roles", () => {
    expect(
      userHasPostPermission(user([], true), "campus-1", "post.review"),
    ).toBe(true);
  });

  it("does not treat a campus-scoped system role as global admin", () => {
    expect(
      userHasPostPermission(
        user([role([], { campusId: "campus-1", isSystemRole: true })]),
        "campus-1",
        "post.review",
      ),
    ).toBe(false);
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

describe("userCanManagePost", () => {
  it("allows authors without a management permission", () => {
    expect(
      userCanManagePost(user([], false, "author-1"), "campus-1", "author-1"),
    ).toBe(true);
  });

  it("allows post.manage to mutate another author's post", () => {
    expect(
      userCanManagePost(user([role(["post.manage"])]), "campus-1", "author-1"),
    ).toBe(true);
  });

  it("does not let post.update mutate another author's post", () => {
    expect(
      userCanManagePost(user([role(["post.update"])]), "campus-1", "author-1"),
    ).toBe(false);
  });
});
