/**
 * Tracked-grant non-propagation guarantees — integration coverage for
 * @doc/specs/tracked-grant-revocation D1 (Scenario 4) and D4 (Scenario 5),
 * fulfilling AC-11 + AC-12.
 *
 * What this locks down:
 *   - Identity/profile split: archive/restore must not touch global User or
 *     Clerk identity state. Archive revokes StaffType-derived grants for the
 *     profile; restore recreates StaffType-derived grants from active types.
 *   - D1: `UpdateStaffTypeUseCase` changing `defaultRoleId` must not propagate
 *     to any existing `user_roles` row. StaffType writes now use UoW for
 *     same-transaction audit, but the invariant remains: the UoW closure must
 *     not call role-grant or role-revoke operations.
 *
 * Pattern: mirrors `update-staff-tracked-grant.integration.spec.ts` (sibling
 * task fd2utj). This repo has no real-DB Postgres harness; every other
 * `*.integration.spec.ts` here uses the same mock-UoW + fake-tx scaffold. We
 * assert the invariant by spying on the role-mutation methods
 * (`assignRoles`, `revokeRolesByProvenance`) and the identity mutation
 * (`updateUser`). If a real-DB harness is introduced later, these tests should
 * be ported to read back `user_roles` directly.
 */

import { ArchiveStaffUseCase } from "./archive-staff.use-case";
import { RestoreStaffUseCase } from "./restore-staff.use-case";
import { UpdateStaffTypeUseCase } from "../staff-type/update-staff-type.use-case";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { RoleRepository } from "../../ports/role.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";
import {
  createStaff,
  createMockStaffRepository,
} from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const USER_ID = "user-1";
const STAFF_ID = "staff-1";
const STAFF_TYPE_ID = "stype-1";
const ROLE_RESTORED = "role-restored";

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

/**
 * Build a fake `TransactionContext` whose role-mutation surface is fully
 * spied. Defaults are benign no-ops; the contract is enforced by the
 * `not.toHaveBeenCalled` assertions in each test.
 */
function buildMockTx() {
  return {
    updateStaff: jest.fn().mockResolvedValue({ id: STAFF_ID }),
    updateUser: jest.fn().mockResolvedValue({ id: USER_ID }),
    assignRoles: jest.fn().mockResolvedValue(0),
    revokeRolesByProvenance: jest.fn().mockResolvedValue(0),
    recordAudit: jest.fn().mockResolvedValue(undefined),
  } as unknown as TransactionContext & {
    updateStaff: jest.Mock;
    updateUser: jest.Mock;
    assignRoles: jest.Mock;
    revokeRolesByProvenance: jest.Mock;
    recordAudit: jest.Mock;
  };
}

describe("Tracked-grant non-propagation (tracked-grant-revocation AC-11, AC-12)", () => {
  // -----------------------------------------------------------------
  // Identity/profile split — Archive/Restore must not touch global identity.
  // -----------------------------------------------------------------
  describe("ArchiveStaffUseCase", () => {
    it("revokes derived grants without mutating global User identity", async () => {
      const staffRepo = createMockStaffRepository();
      staffRepo.findById.mockResolvedValue(
        createStaff({
          id: STAFF_ID,
          campusId: CAMPUS_ID,
          fullName: "Dan Le",
          userId: USER_ID,
          staffTypes: [{ id: STAFF_TYPE_ID, name: "Teacher" }],
        }),
      );

      const mockTx = buildMockTx();
      const unitOfWork = {
        run: jest.fn((task: (tx: TransactionContext) => Promise<unknown>) =>
          task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const useCase = new ArchiveStaffUseCase(staffRepo, unitOfWork);

      await useCase.execute(STAFF_ID, CAMPUS_ID, buildActor());

      // Sanity: archive still does its actual job.
      expect(mockTx.updateStaff).toHaveBeenCalledWith(
        STAFF_ID,
        expect.objectContaining({ isArchived: true }),
      );
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);

      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith(USER_ID, [
        STAFF_TYPE_ID,
      ]);
      expect(mockTx.updateUser).not.toHaveBeenCalled();
    });
  });

  describe("RestoreStaffUseCase", () => {
    it("recreates derived grants without mutating global User identity", async () => {
      const staffRepo = createMockStaffRepository();
      staffRepo.findById.mockResolvedValue(
        createStaff({
          id: STAFF_ID,
          campusId: CAMPUS_ID,
          fullName: "Dan Le",
          userId: USER_ID,
          isArchived: true,
          staffTypes: [{ id: STAFF_TYPE_ID, name: "Teacher" }],
        }),
      );

      const staffTypeRepo = {
        findById: jest.fn().mockResolvedValue({
          id: STAFF_TYPE_ID,
          campusId: CAMPUS_ID,
          name: "Teacher",
          defaultRoleId: ROLE_RESTORED,
          isArchived: false,
        }),
      } as unknown as jest.Mocked<StaffTypeRepository>;

      const mockTx = buildMockTx();
      const unitOfWork = {
        run: jest.fn((task: (tx: TransactionContext) => Promise<unknown>) =>
          task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const useCase = new RestoreStaffUseCase(
        staffRepo,
        staffTypeRepo,
        unitOfWork,
      );

      await useCase.execute(STAFF_ID, CAMPUS_ID, buildActor());

      // Sanity: restore still does its actual job.
      expect(mockTx.updateStaff).toHaveBeenCalledWith(
        STAFF_ID,
        expect.objectContaining({ isArchived: false }),
      );
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);

      expect(mockTx.assignRoles).toHaveBeenCalledWith(USER_ID, [
        {
          roleId: ROLE_RESTORED,
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: STAFF_TYPE_ID,
        },
      ]);
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.updateUser).not.toHaveBeenCalled();
    });
  });

  describe("archive→restore round-trip", () => {
    it("revokes then restores derived grants without global identity mutation", async () => {
      const staffRepo = createMockStaffRepository();
      // Archive sees an active staff; restore sees the post-archive snapshot.
      staffRepo.findById
        .mockResolvedValueOnce(
          createStaff({
            id: STAFF_ID,
            campusId: CAMPUS_ID,
            fullName: "Dan Le",
            userId: USER_ID,
            staffTypes: [{ id: STAFF_TYPE_ID, name: "Teacher" }],
          }),
        )
        .mockResolvedValueOnce(
          createStaff({
            id: STAFF_ID,
            campusId: CAMPUS_ID,
            fullName: "Dan Le",
            userId: USER_ID,
            isArchived: true,
            staffTypes: [{ id: STAFF_TYPE_ID, name: "Teacher" }],
          }),
        );

      const staffTypeRepo = {
        findById: jest.fn().mockResolvedValue({
          id: STAFF_TYPE_ID,
          campusId: CAMPUS_ID,
          name: "Teacher",
          defaultRoleId: ROLE_RESTORED,
          isArchived: false,
        }),
      } as unknown as jest.Mocked<StaffTypeRepository>;

      // One shared tx — both use-case runs accumulate calls on the same
      // spies, so the final assertion covers BOTH closures.
      const mockTx = buildMockTx();
      const unitOfWork = {
        run: jest.fn((task: (tx: TransactionContext) => Promise<unknown>) =>
          task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const archive = new ArchiveStaffUseCase(staffRepo, unitOfWork);
      const restore = new RestoreStaffUseCase(
        staffRepo,
        staffTypeRepo,
        unitOfWork,
      );

      const actor = buildActor();
      await archive.execute(STAFF_ID, CAMPUS_ID, actor);
      await restore.execute(STAFF_ID, CAMPUS_ID, actor);

      // Both closures ran: two staff updates and two audits.
      expect(mockTx.updateStaff).toHaveBeenCalledTimes(2);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(2);

      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith(USER_ID, [
        STAFF_TYPE_ID,
      ]);
      expect(mockTx.assignRoles).toHaveBeenCalledWith(USER_ID, [
        {
          roleId: ROLE_RESTORED,
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: STAFF_TYPE_ID,
        },
      ]);
      expect(mockTx.updateUser).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // AC-12 — UpdateStaffTypeUseCase.defaultRoleId edit must not propagate
  //         to existing user_roles rows (Spec D1, Scenario 4)
  // -----------------------------------------------------------------
  describe("AC-12: UpdateStaffTypeUseCase.defaultRoleId edit does not propagate to user_roles", () => {
    const STAFF_TYPE_ID = "stype-1";
    const ROLE_NEW = "role-new";

    it("only persists and audits the StaffType row; role mutation ops are not called", async () => {
      const initial = StaffType.create(
        {
          campusId: CAMPUS_ID,
          name: "Principal",
          defaultRoleId: "role-old",
          order: 1,
        },
        STAFF_TYPE_ID,
      );

      const staffTypeRepo = {
        findById: jest.fn().mockResolvedValue(initial),
        findByName: jest.fn().mockResolvedValue(null),
        findByOrderAndCampus: jest.fn().mockResolvedValue(null),
        findByCampusId: jest.fn(),
        findAll: jest.fn(),
        save: jest.fn(),
        update: jest
          .fn()
          .mockImplementation((staffType: StaffType) =>
            Promise.resolve(staffType),
          ),
        delete: jest.fn(),
        exists: jest.fn(),
        existsAndNotArchived: jest.fn(),
        getMaxOrder: jest.fn(),
        reorder: jest.fn(),
      } as jest.Mocked<StaffTypeRepository>;

      const roleRepo = {
        findById: jest.fn().mockResolvedValue({
          id: ROLE_NEW,
          name: "New Role",
          description: null,
          campusId: CAMPUS_ID,
          isSystemDefault: false,
          isSystemRole: false,
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      } as unknown as jest.Mocked<RoleRepository>;

      const mockTx = {
        updateStaffType: jest
          .fn()
          .mockImplementation((staffType: StaffType) =>
            Promise.resolve(staffType),
          ),
        assignRoles: jest.fn().mockResolvedValue(0),
        revokeRolesByProvenance: jest.fn().mockResolvedValue(0),
        recordAudit: jest.fn().mockResolvedValue(undefined),
      } as unknown as TransactionContext & {
        updateStaffType: jest.Mock;
        assignRoles: jest.Mock;
        revokeRolesByProvenance: jest.Mock;
        recordAudit: jest.Mock;
      };
      const unitOfWork = {
        run: jest.fn((task: (tx: TransactionContext) => Promise<unknown>) =>
          task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const useCase = new UpdateStaffTypeUseCase(
        staffTypeRepo,
        roleRepo,
        unitOfWork,
      );

      await useCase.execute(
        STAFF_TYPE_ID,
        { campusId: CAMPUS_ID, defaultRoleId: ROLE_NEW },
        buildActor(),
      );

      // The only persistence touch is the StaffType row itself, plus the
      // audit row required by staff-type-rbac-hardening.
      expect(mockTx.updateStaffType).toHaveBeenCalledTimes(1);
      const persisted = mockTx.updateStaffType.mock.calls[0]![0];
      expect(persisted.defaultRoleId).toBe(ROLE_NEW);
      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "UPDATE_STAFF_TYPE",
          beforeValue: { defaultRoleId: "role-old" },
          afterValue: { defaultRoleId: ROLE_NEW },
        }),
      );

      // Validation-only port use: `findById` is a read, not a write.
      expect(roleRepo.findById).toHaveBeenCalledWith(ROLE_NEW);
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
    });
  });
});
