import { BadRequestException } from "@nestjs/common";

import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { RoleRepository } from "@/application/user-management/ports/role.repository";
import { Role } from "@/domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";
import { Permission } from "@/domain/rbac";
import { createMockRoleRepository } from "@/test-utils";

import { PermissionRepository } from "../ports/permission.repository";
import { AssignPermissionsToRoleUseCase } from "./assign-permissions-to-role.use-case";
import { RemovePermissionsFromRoleUseCase } from "./remove-permissions-from-role.use-case";
import { ReplaceRolePermissionsUseCase } from "./replace-role-permissions.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const ROLE_ID = "33333333-3333-4333-a333-333333333333";
const ACTOR_ID = "44444444-4444-4444-a444-444444444444";
const ACTOR_NAME = "Alice Nguyen";

function makePermission(id: string): Permission {
  const [module] = id.split(".");
  return {
    id,
    module,
    description: `${id} permission`,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: ROLE_ID,
    name: "Teacher",
    description: "Classroom teacher",
    campusId: CAMPUS_ID,
    isSystemDefault: false,
    isSystemRole: false,
    permissions: [makePermission("student.read")],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_audit12345",
      isActive: true,
      profile: {
        type: "staff",
        id: ACTOR_ID,
        fullName: ACTOR_NAME,
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    ACTOR_ID,
  );
}

describe("Role permission mutation use cases", () => {
  let roleRepo: jest.Mocked<RoleRepository>;
  let permissionRepo: jest.Mocked<PermissionRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    roleRepo = createMockRoleRepository();
    permissionRepo = {
      findByIds: jest.fn((ids: string[]) =>
        Promise.resolve(ids.map(makePermission)),
      ),
    } as unknown as jest.Mocked<PermissionRepository>;
    mockTx = {
      addRolePermissions: jest.fn().mockResolvedValue(1),
      removeRolePermissions: jest.fn().mockResolvedValue(1),
      replaceRolePermissions: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();
  });

  it("rejects invalid permission IDs before entering the UoW", async () => {
    roleRepo.findById.mockResolvedValue(makeRole());
    permissionRepo.findByIds.mockResolvedValue([makePermission("student.read")]);
    const useCase = new AssignPermissionsToRoleUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await expect(
      useCase.execute(
        {
          roleId: ROLE_ID,
          permissionIds: ["student.read", "student.missing"],
          campusId: CAMPUS_ID,
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(mockTx.recordAudit).not.toHaveBeenCalled();
  });

  it("rejects read-only roles before permission writes", async () => {
    roleRepo.findById.mockResolvedValue(makeRole({ isSystemRole: true }));
    const useCase = new ReplaceRolePermissionsUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await expect(
      useCase.execute(
        {
          roleId: ROLE_ID,
          permissionIds: ["student.read"],
          campusId: CAMPUS_ID,
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(permissionRepo.findByIds).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects cross-campus permission mutation before entering the UoW", async () => {
    roleRepo.findById.mockResolvedValue(
      makeRole({ campusId: OTHER_CAMPUS_ID }),
    );
    const useCase = new RemovePermissionsFromRoleUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await expect(
      useCase.execute(
        {
          roleId: ROLE_ID,
          permissionIds: ["student.read"],
          campusId: CAMPUS_ID,
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("suppresses duplicate permission adds and emits no audit row", async () => {
    roleRepo.findById.mockResolvedValue(makeRole());
    const useCase = new AssignPermissionsToRoleUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await useCase.execute(
      {
        roleId: ROLE_ID,
        permissionIds: ["student.read"],
        campusId: CAMPUS_ID,
      },
      actor,
    );

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(mockTx.addRolePermissions).not.toHaveBeenCalled();
    expect(mockTx.recordAudit).not.toHaveBeenCalled();
  });

  it("audits actual permission additions", async () => {
    roleRepo.findById.mockResolvedValue(makeRole());
    const useCase = new AssignPermissionsToRoleUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await useCase.execute(
      {
        roleId: ROLE_ID,
        permissionIds: ["student.read", "student.update"],
        campusId: CAMPUS_ID,
      },
      actor,
    );

    expect(mockTx.addRolePermissions).toHaveBeenCalledWith(ROLE_ID, [
      "student.update",
    ]);
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_ROLE",
        targetType: "role",
        targetId: ROLE_ID,
        campusId: CAMPUS_ID,
        beforeValue: { permissionIds: ["student.read"] },
        afterValue: {
          permissionIds: ["student.read", "student.update"],
        },
        context: expect.objectContaining({
          roleId: ROLE_ID,
          addedPermissionIds: ["student.update"],
        }),
      }),
    );
  });

  it("suppresses missing permission removals and emits no audit row", async () => {
    roleRepo.findById.mockResolvedValue(makeRole());
    const useCase = new RemovePermissionsFromRoleUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await useCase.execute(
      {
        roleId: ROLE_ID,
        permissionIds: ["student.update"],
        campusId: CAMPUS_ID,
      },
      actor,
    );

    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(mockTx.removeRolePermissions).not.toHaveBeenCalled();
    expect(mockTx.recordAudit).not.toHaveBeenCalled();
  });

  it("audits actual permission removals", async () => {
    roleRepo.findById.mockResolvedValue(makeRole());
    const useCase = new RemovePermissionsFromRoleUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await useCase.execute(
      {
        roleId: ROLE_ID,
        permissionIds: ["student.read"],
        campusId: CAMPUS_ID,
      },
      actor,
    );

    expect(mockTx.removeRolePermissions).toHaveBeenCalledWith(ROLE_ID, [
      "student.read",
    ]);
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_ROLE",
        beforeValue: { permissionIds: ["student.read"] },
        afterValue: { permissionIds: [] },
        context: expect.objectContaining({
          removedPermissionIds: ["student.read"],
        }),
      }),
    );
  });

  it("replaces the full permission set atomically and audits added/removed IDs", async () => {
    roleRepo.findById.mockResolvedValue(makeRole());
    const useCase = new ReplaceRolePermissionsUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await useCase.execute(
      {
        roleId: ROLE_ID,
        permissionIds: ["student.update"],
        campusId: CAMPUS_ID,
      },
      actor,
    );

    expect(mockTx.replaceRolePermissions).toHaveBeenCalledWith(ROLE_ID, [
      "student.update",
    ]);
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_ROLE",
        beforeValue: { permissionIds: ["student.read"] },
        afterValue: { permissionIds: ["student.update"] },
        context: expect.objectContaining({
          addedPermissionIds: ["student.update"],
          removedPermissionIds: ["student.read"],
        }),
      }),
    );
  });

  it("does not audit replace-all when the transactional replace fails", async () => {
    roleRepo.findById.mockResolvedValue(makeRole());
    const dbError = new Error("replace failed");
    mockTx.replaceRolePermissions.mockRejectedValue(dbError);
    const useCase = new ReplaceRolePermissionsUseCase(
      roleRepo,
      permissionRepo,
      unitOfWork,
    );

    await expect(
      useCase.execute(
        {
          roleId: ROLE_ID,
          permissionIds: ["student.update"],
          campusId: CAMPUS_ID,
        },
        actor,
      ),
    ).rejects.toBe(dbError);

    expect(mockTx.recordAudit).not.toHaveBeenCalled();
  });
});
