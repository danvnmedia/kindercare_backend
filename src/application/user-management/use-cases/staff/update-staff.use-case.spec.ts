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
      assignRoles: jest.fn().mockResolvedValue(1),
      revokeRolesByProvenance: jest.fn().mockResolvedValue(0),
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
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [],
        rolesRevoked: [],
      });
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
      // Two lookups now: one for the OLD type (pre-UoW, for `oldDefaultRoleId`)
      // and one for the NEW type (existing validation). Mock by id.
      staffTypeRepo.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === "type-old"
            ? ({
                id: "type-old",
                name: "OldType",
                campusId,
                isArchived: false,
                defaultRoleId: "role-old",
              } as never)
            : ({
                id: "type-new",
                name: "Teacher",
                campusId,
                isArchived: false,
                defaultRoleId: "role-1",
              } as never),
        ),
      );
      roleRepo.findById.mockResolvedValue({ id: "role-1" } as never);

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: "type-new" },
        actor,
      );

      // Tracked-grant pipeline: revoke old provenance, assign new provenance.
      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith(
        "user-1",
        "type-old",
      );
      expect(mockTx.assignRoles).toHaveBeenCalledWith("user-1", [
        {
          roleId: "role-1",
          campusId,
          grantedViaStaffTypeId: "type-new",
        },
      ]);

      // Audit row carries the role-flip arrays alongside the profile diff.
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.beforeValue).toEqual({ staffTypeId: "type-old" });
      expect(payload.afterValue).toEqual({ staffTypeId: "type-new" });
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [{ roleId: "role-1", viaStaffTypeId: "type-new" }],
        rolesRevoked: [{ roleId: "role-old", viaStaffTypeId: "type-old" }],
      });
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

  // Provenance-aware role swap inside EDIT_STAFF_PROFILE — manual grants
  // (provenance NULL) must never be touched; tracked grants must be revoked
  // by `(userId, oldStaffTypeId)` and reissued under the new type's
  // provenance. See @doc/specs/tracked-grant-revocation.
  describe("tracked-grant revocation", () => {
    const USER_ID = "user-1";
    const OLD_TYPE = "type-old";
    const NEW_TYPE = "type-new";
    const OLD_ROLE = "role-old";
    const NEW_ROLE = "role-new";

    function mockStaffTypes(opts: {
      oldDefaultRoleId?: string | null;
      newDefaultRoleId?: string | null;
    }) {
      staffTypeRepo.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === OLD_TYPE
            ? ({
                id: OLD_TYPE,
                name: "Old",
                campusId,
                isArchived: false,
                defaultRoleId: opts.oldDefaultRoleId ?? null,
              } as never)
            : id === NEW_TYPE
              ? ({
                  id: NEW_TYPE,
                  name: "New",
                  campusId,
                  isArchived: false,
                  defaultRoleId: opts.newDefaultRoleId ?? null,
                } as never)
              : null,
        ),
      );
    }

    it("A→B: revokes old provenance and inserts new (both arrays populated)", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        staffTypeId: OLD_TYPE,
        userId: USER_ID,
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockStaffTypes({
        oldDefaultRoleId: OLD_ROLE,
        newDefaultRoleId: NEW_ROLE,
      });
      roleRepo.findById.mockResolvedValue({ id: NEW_ROLE } as never);
      mockTx.assignRoles.mockResolvedValueOnce(1);

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: NEW_TYPE },
        actor,
      );

      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith(
        USER_ID,
        OLD_TYPE,
      );
      expect(mockTx.assignRoles).toHaveBeenCalledWith(USER_ID, [
        {
          roleId: NEW_ROLE,
          campusId,
          grantedViaStaffTypeId: NEW_TYPE,
        },
      ]);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [{ roleId: NEW_ROLE, viaStaffTypeId: NEW_TYPE }],
        rolesRevoked: [{ roleId: OLD_ROLE, viaStaffTypeId: OLD_TYPE }],
      });
    });

    it("A→null: revokes old, no assign (spec AC-6)", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        staffTypeId: OLD_TYPE,
        userId: USER_ID,
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockStaffTypes({ oldDefaultRoleId: OLD_ROLE });

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: null },
        actor,
      );

      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith(
        USER_ID,
        OLD_TYPE,
      );
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [],
        rolesRevoked: [{ roleId: OLD_ROLE, viaStaffTypeId: OLD_TYPE }],
      });
    });

    it("null→A: no revoke, assigns new with provenance (spec AC-7)", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        staffTypeId: null,
        userId: USER_ID,
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockStaffTypes({ newDefaultRoleId: NEW_ROLE });
      roleRepo.findById.mockResolvedValue({ id: NEW_ROLE } as never);
      mockTx.assignRoles.mockResolvedValueOnce(1);

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: NEW_TYPE },
        actor,
      );

      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).toHaveBeenCalledWith(USER_ID, [
        {
          roleId: NEW_ROLE,
          campusId,
          grantedViaStaffTypeId: NEW_TYPE,
        },
      ]);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [{ roleId: NEW_ROLE, viaStaffTypeId: NEW_TYPE }],
        rolesRevoked: [],
      });
    });

    it("A→A (same value supplied): no role mutation; no audit row at all", async () => {
      // input.staffTypeId equals current value → the staffType-change guard
      // never fires; nothing reaches the diff; nothing reaches the role swap.
      const staff = createStaff({
        id: "staff-1",
        campusId,
        staffTypeId: OLD_TYPE,
        userId: USER_ID,
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: OLD_TYPE },
        actor,
      );

      expect(staffTypeRepo.findById).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("staff.userId = null: skips revoke + assign entirely (spec AC-13)", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        staffTypeId: OLD_TYPE,
        userId: null,
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockStaffTypes({
        oldDefaultRoleId: OLD_ROLE,
        newDefaultRoleId: NEW_ROLE,
      });

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: NEW_TYPE },
        actor,
      );

      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [],
        rolesRevoked: [],
      });
    });

    it("new type has no defaultRoleId: revokes old, no insert (spec AC-16)", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId,
        staffTypeId: OLD_TYPE,
        userId: USER_ID,
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockStaffTypes({
        oldDefaultRoleId: OLD_ROLE,
        newDefaultRoleId: null,
      });

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: NEW_TYPE },
        actor,
      );

      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith(
        USER_ID,
        OLD_TYPE,
      );
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [],
        rolesRevoked: [{ roleId: OLD_ROLE, viaStaffTypeId: OLD_TYPE }],
      });
    });

    it("manual-grant conflict (D5): inserted=0 keeps rolesGranted empty (spec AC-14)", async () => {
      // Simulates an existing manual `user_roles` row with the same
      // (userId, roleId, campusId) — the createMany skipDuplicates returns 0
      // and the use case must NOT advertise the row as granted.
      const staff = createStaff({
        id: "staff-1",
        campusId,
        staffTypeId: null,
        userId: USER_ID,
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockStaffTypes({ newDefaultRoleId: NEW_ROLE });
      roleRepo.findById.mockResolvedValue({ id: NEW_ROLE } as never);
      mockTx.assignRoles.mockResolvedValueOnce(0);

      await useCase.execute(
        "staff-1",
        { campusId, staffTypeId: NEW_TYPE },
        actor,
      );

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [],
        rolesRevoked: [],
      });
    });
  });
});
