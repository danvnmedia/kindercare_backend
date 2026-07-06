import { BadRequestException } from "@nestjs/common";

import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { Role } from "@/domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";
import { createMockRoleRepository } from "@/test-utils";

import { RoleRepository } from "../../ports/role.repository";
import { CreateRoleUseCase } from "./create-role.use-case";
import { DeleteRoleUseCase } from "./delete-role.use-case";
import { UpdateRoleUseCase } from "./update-role.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const ROLE_ID = "33333333-3333-4333-a333-333333333333";
const ACTOR_ID = "44444444-4444-4444-a444-444444444444";
const ACTOR_NAME = "Alice Nguyen";

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

function buildRole(overrides: Partial<Role> = {}): Role {
  return {
    id: ROLE_ID,
    name: "Teacher",
    description: "Classroom teacher",
    campusId: CAMPUS_ID,
    isSystemDefault: false,
    isSystemRole: false,
    permissions: [
      {
        id: "student.read",
        module: "student",
        description: "Read students",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("Role CRUD mutation use cases", () => {
  let roleRepo: jest.Mocked<RoleRepository>;
  let campusRepo: jest.Mocked<CampusRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    roleRepo = createMockRoleRepository();
    campusRepo = {
      exists: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<CampusRepository>;
    mockTx = {
      createRole: jest.fn(),
      updateRole: jest.fn(),
      deleteRole: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();
  });

  describe("CreateRoleUseCase", () => {
    it("creates a campus role without a caller-supplied ID and audits the created role", async () => {
      const createdRole = buildRole({ name: "Lead Teacher" });
      roleRepo.findByName.mockResolvedValue(null);
      mockTx.createRole.mockResolvedValue(createdRole);

      const useCase = new CreateRoleUseCase(roleRepo, campusRepo, unitOfWork);

      await useCase.execute(
        {
          name: " Lead Teacher ",
          description: "  Senior classroom teacher  ",
          campusId: CAMPUS_ID,
          permissionIds: ["student.read"],
        },
        actor,
      );

      expect(mockTx.createRole).toHaveBeenCalledWith({
        name: "Lead Teacher",
        description: "Senior classroom teacher",
        campusId: CAMPUS_ID,
        isSystemDefault: false,
        isSystemRole: false,
        permissionIds: ["student.read"],
      });
      expect(mockTx.createRole.mock.calls[0]![0]).not.toHaveProperty("id");
      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: "CREATE_ROLE",
          targetType: "role",
          targetId: ROLE_ID,
          campusId: CAMPUS_ID,
          afterValue: expect.objectContaining({
            name: "Lead Teacher",
            permissionIds: ["student.read"],
          }),
        }),
      );
    });

    it("rejects API-created system/default roles before entering the UoW", async () => {
      const useCase = new CreateRoleUseCase(roleRepo, campusRepo, unitOfWork);

      await expect(
        useCase.execute(
          { name: "Admin", campusId: CAMPUS_ID, isSystemRole: true },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        useCase.execute(
          { name: "Default", campusId: CAMPUS_ID, isSystemDefault: true },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.createRole).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });
  });

  describe("UpdateRoleUseCase", () => {
    it("rejects cross-campus updates before entering the UoW", async () => {
      roleRepo.findById.mockResolvedValue(
        buildRole({ campusId: OTHER_CAMPUS_ID }),
      );
      const useCase = new UpdateRoleUseCase(roleRepo, campusRepo, unitOfWork);

      await expect(
        useCase.execute(
          ROLE_ID,
          { name: "Lead Teacher", campusId: CAMPUS_ID },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.updateRole).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("rejects system-default roles before entering the UoW", async () => {
      roleRepo.findById.mockResolvedValue(buildRole({ isSystemDefault: true }));
      const useCase = new UpdateRoleUseCase(roleRepo, campusRepo, unitOfWork);

      await expect(
        useCase.execute(
          ROLE_ID,
          { name: "Lead Teacher", campusId: CAMPUS_ID },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("updates a campus role and audits only changed fields", async () => {
      roleRepo.findById.mockResolvedValue(buildRole());
      roleRepo.findByName.mockResolvedValue(null);
      mockTx.updateRole.mockResolvedValue(buildRole({ name: "Lead Teacher" }));
      const useCase = new UpdateRoleUseCase(roleRepo, campusRepo, unitOfWork);

      await useCase.execute(
        ROLE_ID,
        { name: "Lead Teacher", campusId: CAMPUS_ID },
        actor,
      );

      expect(mockTx.updateRole).toHaveBeenCalledWith(ROLE_ID, {
        name: "Lead Teacher",
      });
      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: "UPDATE_ROLE",
          targetType: "role",
          targetId: ROLE_ID,
          campusId: CAMPUS_ID,
          beforeValue: { name: "Teacher" },
          afterValue: { name: "Lead Teacher" },
        }),
      );
    });
  });

  describe("DeleteRoleUseCase", () => {
    it("deletes a campus role and audits the deleted snapshot", async () => {
      roleRepo.findById.mockResolvedValue(buildRole());
      const useCase = new DeleteRoleUseCase(roleRepo, unitOfWork);

      await useCase.execute(ROLE_ID, { campusId: CAMPUS_ID }, actor);

      expect(mockTx.deleteRole).toHaveBeenCalledWith(ROLE_ID);
      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: "DELETE_ROLE",
          targetType: "role",
          targetId: ROLE_ID,
          campusId: CAMPUS_ID,
          beforeValue: expect.objectContaining({
            name: "Teacher",
            permissionIds: ["student.read"],
          }),
        }),
      );
    });
  });
});
