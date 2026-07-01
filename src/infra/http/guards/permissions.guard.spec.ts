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

import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { RequestContext } from "../context/request-context.service";
import { PermissionsGuard } from "./permissions.guard";

function permission(id: string): Permission {
  const [module] = id.split(".");

  return {
    id,
    module,
    description: null,
    createdAt: new Date(),
  };
}

function mockExecutionContext(): ExecutionContext {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function mockRequestContext(
  user: Awaited<ReturnType<RequestContext["getUser"]>>,
  campusId = DEFAULT_CAMPUS_ID_A,
): jest.Mocked<RequestContext> {
  return {
    get campusId() {
      return campusId;
    },
    getUser: jest.fn().mockResolvedValue(user),
  } as unknown as jest.Mocked<RequestContext>;
}

describe("PermissionsGuard", () => {
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
  });

  it("allows staff with any required Medication permission in the selected campus", async () => {
    reflector.getAllAndOverride.mockReturnValue([
      "medication_administration.create",
      "medication_administration.update",
    ]);
    const role = createRole({
      permissions: [permission("medication_administration.update")],
    });
    const user = createUser({
      roleAssignments: [createRoleAssignment(role, DEFAULT_CAMPUS_ID_A)],
    });
    const requestContext = mockRequestContext(user);
    const guard = new PermissionsGuard(reflector, requestContext);

    await expect(guard.canActivate(mockExecutionContext())).resolves.toBe(true);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, [
      expect.any(Function),
      expect.any(Function),
    ]);
    expect(requestContext.getUser).toHaveBeenCalledTimes(1);
  });

  it("denies staff without medication request read or list permission before handler data can be returned", async () => {
    reflector.getAllAndOverride.mockReturnValue([
      "medication_request.read",
      "medication_request.list",
    ]);
    const role = createRole({
      permissions: [
        permission("student.read"),
        permission("student_health.read"),
      ],
    });
    const user = createUser({
      roleAssignments: [createRoleAssignment(role, DEFAULT_CAMPUS_ID_A)],
    });
    const requestContext = mockRequestContext(user);
    const guard = new PermissionsGuard(reflector, requestContext);

    await expect(guard.canActivate(mockExecutionContext())).resolves.toBe(
      false,
    );

    expect(requestContext.getUser).toHaveBeenCalledTimes(1);
  });

  it("denies medication permission assigned only to another campus", async () => {
    reflector.getAllAndOverride.mockReturnValue(["medication_request.read"]);
    const role = createRole({
      permissions: [permission("medication_request.read")],
    });
    const user = createUser({
      roleAssignments: [createRoleAssignment(role, DEFAULT_CAMPUS_ID_B)],
    });
    const requestContext = mockRequestContext(user, DEFAULT_CAMPUS_ID_A);
    const guard = new PermissionsGuard(reflector, requestContext);

    await expect(guard.canActivate(mockExecutionContext())).resolves.toBe(
      false,
    );
  });
});
