import { BadRequestException, NotFoundException } from "@nestjs/common";

import { UpdateStaffUseCase } from "./update-staff.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { UserRepository } from "../../ports/user.repository";
import { RoleRepository } from "../../ports/role.repository";
import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import {
  createStaff,
  createMockStaffRepository,
  createMockUserRepository,
  createMockRoleRepository,
} from "@/test-utils";

const ACTOR_ID = "actor-1";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_audit12345",
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
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ACTOR_ID,
  );
}

describe("UpdateStaffUseCase", () => {
  let useCase: UpdateStaffUseCase;
  let staffRepo: jest.Mocked<StaffRepository>;
  let staffTypeRepo: jest.Mocked<StaffTypeRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let identityPort: jest.Mocked<IdentityPort>;
  let actor: User;

  const campusId = "11111111-1111-4111-a111-111111111111";

  beforeEach(() => {
    staffRepo = createMockStaffRepository();
    staffTypeRepo = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findByDefaultRoleId: jest.fn(),
      findAll: jest.fn(),
      findAllPaginated: jest.fn(),
      findNonArchived: jest.fn(),
      reorder: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      archive: jest.fn(),
      unarchive: jest.fn(),
    } as unknown as jest.Mocked<StaffTypeRepository>;
    userRepo = createMockUserRepository();
    roleRepo = createMockRoleRepository();
    mockTx = {
      updateStaff: jest.fn().mockResolvedValue({ id: "staff-1" }),
      assignRoles: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    identityPort = {
      createUser: jest.fn(),
      updateUser: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn(),
    } as unknown as jest.Mocked<IdentityPort>;
    actor = buildActor();

    useCase = new UpdateStaffUseCase(
      staffRepo,
      staffTypeRepo,
      userRepo,
      roleRepo,
      unitOfWork,
      identityPort,
    );
  });

  describe("DB-only path (no User account)", () => {
    it("AC-3 — emits EDIT_STAFF_PROFILE with only changed fields", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        fullName: "Dan Le",
        address: null,
        userId: null,
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute(
        "staff-1",
        { campusId, address: "12 Pine St" },
        actor,
      );

      expect(identityPort.updateUser).not.toHaveBeenCalled();
      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);

      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("EDIT_STAFF_PROFILE");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe("staff-1");
      expect(payload.campusId).toBe(campusId);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({ actorName: "Alice Nguyen" });
      expect(payload.beforeValue).toEqual({ address: null });
      expect(payload.afterValue).toEqual({ address: "12 Pine St" });
    });

    it("no-op edit does NOT emit an audit row", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        address: "12 Pine St",
        userId: null,
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute(
        "staff-1",
        { campusId, address: "12 Pine St" },
        actor,
      );

      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("staffType change records staffTypeId in the diff and runs assignRoles", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        staffTypeId: "type-old",
        userId: "user-1",
      });
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockResolvedValue({
        id: "type-new",
        name: "Teacher",
        campusId,
        isArchived: false,
        defaultRoleId: "role-1",
      } as never);
      roleRepo.findById.mockResolvedValue({ id: "role-1" } as never);

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: "type-new" },
        actor,
      );

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.beforeValue).toEqual({ staffTypeId: "type-old" });
      expect(payload.afterValue).toEqual({ staffTypeId: "type-new" });
    });
  });

  describe("Clerk-saga path", () => {
    it("emits audit AFTER Clerk + updateStaff succeed", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        fullName: "Dan Le",
        email: "dan@example.com",
        userId: "user-1",
      });
      staffRepo.findById.mockResolvedValue(staff);
      userRepo.findById.mockResolvedValue(
        User.reconstitute(
          {
            clerkUid: "user_clerk1234567",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          "user-1",
        ),
      );

      await useCase.execute(
        "staff-1",
        { campusId, email: "dan.new@example.com" },
        actor,
      );

      expect(identityPort.updateUser).toHaveBeenCalledTimes(1);
      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.beforeValue).toEqual({ email: "dan@example.com" });
      expect(payload.afterValue).toEqual({ email: "dan.new@example.com" });
    });

    it("AC-4 — recorder failure triggers Clerk revert", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        email: "dan@example.com",
        userId: "user-1",
      });
      staffRepo.findById.mockResolvedValue(staff);
      userRepo.findById.mockResolvedValue(
        User.reconstitute(
          {
            clerkUid: "user_clerk1234567",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          "user-1",
        ),
      );
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute(
          "staff-1",
          { campusId, email: "dan.new@example.com" },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(identityPort.updateUser).toHaveBeenCalledTimes(2);
      expect(identityPort.updateUser.mock.calls[1]![1]).toEqual({
        email: "dan@example.com",
      });
    });
  });

  describe("AC-4 — audit failure on DB-only path", () => {
    it("propagates recorder error and ran updateStaff inside the UoW", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        address: null,
        userId: null,
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute("staff-1", { campusId, address: "12 Pine St" }, actor),
      ).rejects.toThrow("audit fail");

      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when staff does not exist", async () => {
      staffRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("missing", { campusId, fullName: "X" }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when staff belongs to a different campus", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: "22222222-2222-4222-a222-222222222222",
      });
      staffRepo.findById.mockResolvedValue(staff);

      await expect(
        useCase.execute("staff-1", { campusId, fullName: "X" }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
