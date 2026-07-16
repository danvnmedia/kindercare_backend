import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { Permission } from "@/domain/rbac";
import {
  createRole,
  createRoleAssignment,
  createUser,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

import { RequestContext } from "../context/request-context.service";
import { REQUIRED_ALL_PERMISSIONS_KEY } from "../decorators/require-all-permissions.decorator";
import { AllPermissionsGuard } from "./all-permissions.guard";

const REQUIRED_PERMISSIONS = [
  "medication_request.read",
  "medication_administration.read",
];

function permission(id: string): Permission {
  const [module] = id.split(".");
  return {
    id,
    module,
    description: null,
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
  };
}

function executionContext(): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function requestContext(
  user: Awaited<ReturnType<RequestContext["getUser"]>>,
): jest.Mocked<RequestContext> {
  return {
    get campusId() {
      return DEFAULT_CAMPUS_ID_A;
    },
    getUser: jest.fn().mockResolvedValue(user),
  } as unknown as jest.Mocked<RequestContext>;
}

describe("AllPermissionsGuard", () => {
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(REQUIRED_PERMISSIONS),
    } as unknown as jest.Mocked<Reflector>;
  });

  it("allows a campus role with every required permission", async () => {
    const role = createRole({
      permissions: REQUIRED_PERMISSIONS.map(permission),
    });
    const user = createUser({
      roleAssignments: [createRoleAssignment(role, DEFAULT_CAMPUS_ID_A)],
    });
    const guard = new AllPermissionsGuard(reflector, requestContext(user));

    await expect(guard.canActivate(executionContext())).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      REQUIRED_ALL_PERMISSIONS_KEY,
      [expect.any(Function), expect.any(Function)],
    );
  });

  it.each(REQUIRED_PERMISSIONS)(
    "denies a campus role that has only %s",
    async (onlyPermission) => {
      const role = createRole({ permissions: [permission(onlyPermission)] });
      const user = createUser({
        roleAssignments: [createRoleAssignment(role, DEFAULT_CAMPUS_ID_A)],
      });
      const guard = new AllPermissionsGuard(reflector, requestContext(user));

      await expect(guard.canActivate(executionContext())).resolves.toBe(false);
    },
  );

  it("does not combine permissions assigned only in another campus", async () => {
    const selectedCampusRole = createRole({
      permissions: [permission("medication_request.read")],
    });
    const otherCampusRole = createRole({
      permissions: [permission("medication_administration.read")],
    });
    const user = createUser({
      roleAssignments: [
        createRoleAssignment(selectedCampusRole, DEFAULT_CAMPUS_ID_A),
        createRoleAssignment(otherCampusRole, DEFAULT_CAMPUS_ID_B),
      ],
    });
    const guard = new AllPermissionsGuard(reflector, requestContext(user));

    await expect(guard.canActivate(executionContext())).resolves.toBe(false);
  });

  it("preserves global system-role access", async () => {
    const systemRole = createRole({ isSystemRole: true, permissions: [] });
    const user = createUser({
      roleAssignments: [createRoleAssignment(systemRole, null)],
    });
    const guard = new AllPermissionsGuard(reflector, requestContext(user));

    await expect(guard.canActivate(executionContext())).resolves.toBe(true);
  });
});
