import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Role } from "@/domain/user-management/role.entity";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";
import { createMockRoleRepository } from "@/test-utils";

import { RoleRepository } from "../../ports/role.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { CreateStaffTypeUseCase } from "./create-staff-type.use-case";
import { DeleteStaffTypeUseCase } from "./delete-staff-type.use-case";
import { GetStaffTypeByIdUseCase } from "./get-staff-type-by-id.use-case";
import { UpdateStaffTypeUseCase } from "./update-staff-type.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const STAFF_TYPE_ID = "33333333-3333-4333-a333-333333333333";
const ROLE_ID = "44444444-4444-4444-a444-444444444444";
const ACTOR_ID = "55555555-5555-4555-a555-555555555555";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_stafftypeactor",
      isActive: true,
      profile: {
        type: "staff",
        id: ACTOR_ID,
        fullName: "Alice Nguyen",
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
    description: null,
    campusId: CAMPUS_ID,
    isSystemDefault: false,
    isSystemRole: false,
    permissions: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildStaffType(
  overrides: Partial<{
    id: string;
    campusId: string;
    name: string;
    description: string | null;
    defaultRoleId: string | null;
    isArchived: boolean;
    order: number;
  }> = {},
): StaffType {
  return StaffType.create(
    {
      campusId: overrides.campusId ?? CAMPUS_ID,
      name: overrides.name ?? "Teacher",
      description: overrides.description ?? null,
      defaultRoleId: overrides.defaultRoleId ?? null,
      isArchived: overrides.isArchived ?? false,
      order: overrides.order ?? 1,
    },
    overrides.id ?? STAFF_TYPE_ID,
  );
}

function createMockStaffTypeRepository(): jest.Mocked<StaffTypeRepository> {
  return {
    findById: jest.fn(),
    findByName: jest.fn(),
    findByOrderAndCampus: jest.fn(),
    findByCampusId: jest.fn(),
    findAll: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsAndNotArchived: jest.fn(),
    getMaxOrder: jest.fn(),
    reorder: jest.fn(),
  } as jest.Mocked<StaffTypeRepository>;
}

function createMockTx(): jest.Mocked<TransactionContext> & {
  assignRoles: jest.Mock;
  revokeRolesByProvenance: jest.Mock;
} {
  return {
    createStaffType: jest.fn(),
    updateStaffType: jest.fn(),
    reorderStaffTypes: jest.fn(),
    recordAudit: jest.fn().mockResolvedValue(undefined),
    assignRoles: jest.fn().mockResolvedValue(0),
    revokeRolesByProvenance: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<TransactionContext> & {
    assignRoles: jest.Mock;
    revokeRolesByProvenance: jest.Mock;
  };
}

describe("StaffType CRUD hardening use cases", () => {
  let staffTypeRepo: jest.Mocked<StaffTypeRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let tx: jest.Mocked<TransactionContext> & {
    assignRoles: jest.Mock;
    revokeRolesByProvenance: jest.Mock;
  };
  let actor: User;

  beforeEach(() => {
    staffTypeRepo = createMockStaffTypeRepository();
    roleRepo = createMockRoleRepository();
    tx = createMockTx();
    unitOfWork = {
      run: jest.fn((task) => task(tx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();
  });

  describe("CreateStaffTypeUseCase", () => {
    it("rejects a missing defaultRoleId before entering the UoW", async () => {
      staffTypeRepo.findByName.mockResolvedValue(null);
      roleRepo.findById.mockResolvedValue(null);

      const useCase = new CreateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      await expect(
        useCase.execute(
          { campusId: CAMPUS_ID, name: "Teacher", defaultRoleId: ROLE_ID },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(tx.createStaffType).not.toHaveBeenCalled();
      expect(tx.recordAudit).not.toHaveBeenCalled();
    });

    it.each([
      ["cross-campus", buildRole({ campusId: OTHER_CAMPUS_ID })],
      ["global", buildRole({ campusId: null })],
      ["system", buildRole({ isSystemRole: true })],
      ["system default", buildRole({ isSystemDefault: true })],
    ])("rejects a %s default role", async (_caseName, role) => {
      staffTypeRepo.findByName.mockResolvedValue(null);
      roleRepo.findById.mockResolvedValue(role);

      const useCase = new CreateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      await expect(
        useCase.execute(
          { campusId: CAMPUS_ID, name: "Teacher", defaultRoleId: ROLE_ID },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("creates the StaffType and emits CREATE_STAFF_TYPE atomically", async () => {
      const created = buildStaffType({ defaultRoleId: ROLE_ID });
      staffTypeRepo.findByName.mockResolvedValue(null);
      staffTypeRepo.getMaxOrder.mockResolvedValue(0);
      roleRepo.findById.mockResolvedValue(buildRole());
      tx.createStaffType.mockResolvedValue(created);

      const useCase = new CreateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      const result = await useCase.execute(
        { campusId: CAMPUS_ID, name: "Teacher", defaultRoleId: ROLE_ID },
        actor,
      );

      expect(result).toBe(created);
      expect(tx.createStaffType).toHaveBeenCalledWith(
        expect.objectContaining({
          campusId: CAMPUS_ID,
          name: "Teacher",
          defaultRoleId: ROLE_ID,
        }),
      );
      expect(tx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: "CREATE_STAFF_TYPE",
          targetType: "staff_type",
          targetId: STAFF_TYPE_ID,
          campusId: CAMPUS_ID,
          afterValue: expect.objectContaining({
            name: "Teacher",
            defaultRoleId: ROLE_ID,
          }),
        }),
      );
    });

    it("still rejects duplicate names before writes", async () => {
      staffTypeRepo.findByName.mockResolvedValue(buildStaffType());

      const useCase = new CreateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      await expect(
        useCase.execute({ campusId: CAMPUS_ID, name: "Teacher" }, actor),
      ).rejects.toThrow(ConflictException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("GetStaffTypeByIdUseCase", () => {
    it("hides StaffTypes outside the active campus", async () => {
      staffTypeRepo.findById.mockResolvedValue(
        buildStaffType({ campusId: OTHER_CAMPUS_ID }),
      );
      const useCase = new GetStaffTypeByIdUseCase(staffTypeRepo);

      await expect(useCase.execute(STAFF_TYPE_ID, CAMPUS_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("UpdateStaffTypeUseCase", () => {
    it("hides cross-campus StaffTypes before entering the UoW", async () => {
      staffTypeRepo.findById.mockResolvedValue(
        buildStaffType({ campusId: OTHER_CAMPUS_ID }),
      );

      const useCase = new UpdateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      await expect(
        useCase.execute(
          STAFF_TYPE_ID,
          { campusId: CAMPUS_ID, name: "Lead Teacher" },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("rejects unsafe default roles on update", async () => {
      staffTypeRepo.findById.mockResolvedValue(buildStaffType());
      roleRepo.findById.mockResolvedValue(buildRole({ isSystemRole: true }));

      const useCase = new UpdateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      await expect(
        useCase.execute(
          STAFF_TYPE_ID,
          { campusId: CAMPUS_ID, defaultRoleId: ROLE_ID },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("updates and audits only changed StaffType fields", async () => {
      const current = buildStaffType({ name: "Teacher" });
      const updated = buildStaffType({ name: "Lead Teacher" });
      staffTypeRepo.findById.mockResolvedValue(current);
      staffTypeRepo.findByName.mockResolvedValue(null);
      tx.updateStaffType.mockResolvedValue(updated);

      const useCase = new UpdateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      const result = await useCase.execute(
        STAFF_TYPE_ID,
        { campusId: CAMPUS_ID, name: "Lead Teacher" },
        actor,
      );

      expect(result).toBe(updated);
      expect(tx.updateStaffType).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Lead Teacher" }),
      );
      expect(tx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: "UPDATE_STAFF_TYPE",
          targetType: "staff_type",
          targetId: STAFF_TYPE_ID,
          campusId: CAMPUS_ID,
          beforeValue: { name: "Teacher" },
          afterValue: { name: "Lead Teacher" },
        }),
      );
    });

    it("does not propagate defaultRoleId changes into user role mutations", async () => {
      const current = buildStaffType({ defaultRoleId: null });
      const updated = buildStaffType({ defaultRoleId: ROLE_ID });
      staffTypeRepo.findById.mockResolvedValue(current);
      roleRepo.findById.mockResolvedValue(buildRole());
      tx.updateStaffType.mockResolvedValue(updated);

      const useCase = new UpdateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      await useCase.execute(
        STAFF_TYPE_ID,
        { campusId: CAMPUS_ID, defaultRoleId: ROLE_ID },
        actor,
      );

      expect(tx.updateStaffType).toHaveBeenCalledTimes(1);
      expect(tx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE_STAFF_TYPE",
          beforeValue: { defaultRoleId: null },
          afterValue: { defaultRoleId: ROLE_ID },
        }),
      );
      expect(tx.assignRoles).not.toHaveBeenCalled();
      expect(tx.revokeRolesByProvenance).not.toHaveBeenCalled();
    });
  });

  describe("DeleteStaffTypeUseCase", () => {
    it("hides cross-campus archive attempts before entering the UoW", async () => {
      staffTypeRepo.findById.mockResolvedValue(
        buildStaffType({ campusId: OTHER_CAMPUS_ID }),
      );

      const useCase = new DeleteStaffTypeUseCase(staffTypeRepo, unitOfWork);

      await expect(
        useCase.execute(STAFF_TYPE_ID, { campusId: CAMPUS_ID }, actor),
      ).rejects.toThrow(NotFoundException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("archives and emits ARCHIVE_STAFF_TYPE atomically", async () => {
      const current = buildStaffType({ isArchived: false });
      const archived = buildStaffType({ isArchived: true });
      staffTypeRepo.findById.mockResolvedValue(current);
      tx.updateStaffType.mockResolvedValue(archived);

      const useCase = new DeleteStaffTypeUseCase(staffTypeRepo, unitOfWork);

      const result = await useCase.execute(
        STAFF_TYPE_ID,
        { campusId: CAMPUS_ID },
        actor,
      );

      expect(result).toBe(archived);
      expect(tx.updateStaffType).toHaveBeenCalledWith(
        expect.objectContaining({ isArchived: true }),
      );
      expect(tx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ACTOR_ID,
          action: "ARCHIVE_STAFF_TYPE",
          targetType: "staff_type",
          targetId: STAFF_TYPE_ID,
          campusId: CAMPUS_ID,
          beforeValue: expect.objectContaining({ isArchived: false }),
          afterValue: expect.objectContaining({ isArchived: true }),
        }),
      );
    });
  });
});
