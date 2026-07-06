import { RequestContext } from "../context/request-context.service";
import { GlobalAdminGuard } from "./global-admin.guard";
import {
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

const CAMPUS_ID = "33333333-3333-4333-a333-333333333333";

function buildUser(isSystemRole: boolean, campusId: string | null) {
  const role = createRole({
    id: "role-1",
    isSystemRole,
    campusId: null,
  });

  return createUser({
    id: "user-1",
    roleAssignments: [createRoleAssignment(role, campusId)],
  });
}

describe("GlobalAdminGuard", () => {
  it("allows a user with a global system role", async () => {
    const requestContext = {
      getUserOrFail: jest.fn().mockResolvedValue(buildUser(true, null)),
    } as unknown as RequestContext;
    const guard = new GlobalAdminGuard(requestContext);

    await expect(guard.canActivate()).resolves.toBe(true);
  });

  it("denies a campus-scoped system role", async () => {
    const requestContext = {
      getUserOrFail: jest.fn().mockResolvedValue(buildUser(true, CAMPUS_ID)),
    } as unknown as RequestContext;
    const guard = new GlobalAdminGuard(requestContext);

    await expect(guard.canActivate()).resolves.toBe(false);
  });

  it("denies a non-system global role", async () => {
    const requestContext = {
      getUserOrFail: jest.fn().mockResolvedValue(buildUser(false, null)),
    } as unknown as RequestContext;
    const guard = new GlobalAdminGuard(requestContext);

    await expect(guard.canActivate()).resolves.toBe(false);
  });
});
