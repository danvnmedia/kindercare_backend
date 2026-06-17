/**
 * Tracked-grant non-propagation guarantees — integration coverage for
 * @doc/specs/tracked-grant-revocation D1 (Scenario 4) and D4 (Scenario 5),
 * fulfilling AC-11 + AC-12.
 *
 * What this locks down:
 *   - D4: Archive/restore must not touch `user_roles`. The auto-granted role
 *     row persists across the archive→restore cycle; only the Clerk lock +
 *     `user.isActive = false` blocks an archived user. Restoring is one-click
 *     — no role re-grant needed.
 *   - D1: `UpdateStaffTypeUseCase` changing `defaultRoleId` must not propagate
 *     to any existing `user_roles` row. The use case has zero role-mutation
 *     surface area today — no UoW dependency. That absence is the structural
 *     enforcement of D1, and this file pins it.
 *
 * Pattern: mirrors `update-staff-tracked-grant.integration.spec.ts` (sibling
 * task fd2utj). This repo has no real-DB Postgres harness; every other
 * `*.integration.spec.ts` here uses the same mock-UoW + fake-tx scaffold. We
 * assert the invariant NEGATIVELY: the role-mutation methods
 * (`assignRoles`, `revokeRolesByProvenance`) exist on the fake `tx` but are
 * never called by archive/restore. If a real-DB harness is introduced later,
 * these tests should be ported to read back `user_roles` directly.
 */

import { ArchiveStaffUseCase } from "./archive-staff.use-case";
import { RestoreStaffUseCase } from "./restore-staff.use-case";
import { UpdateStaffTypeUseCase } from "../staff-type/update-staff-type.use-case";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { RoleRepository } from "../../ports/role.repository";
import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";
import {
  createStaff,
  createMockStaffRepository,
  createMockUserRepository,
} from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const USER_ID = "user-1";
const STAFF_ID = "staff-1";

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
  // AC-11 — Archive/Restore must not touch user_roles
  //         (Spec D4, Scenario 5)
  // -----------------------------------------------------------------
  describe("AC-11: ArchiveStaffUseCase does not mutate user_roles", () => {
    it("runs the archive UoW closure without invoking any role-mutation port", async () => {
      const staffRepo = createMockStaffRepository();
      staffRepo.findById.mockResolvedValue(
        createStaff({
          id: STAFF_ID,
          campusId: CAMPUS_ID,
          fullName: "Dan Le",
          userId: USER_ID,
        }),
      );

      const userRepo = createMockUserRepository();
      userRepo.findById.mockResolvedValue(
        User.reconstitute(
          {
            clerkUid: "user_clerk1234567",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          USER_ID,
        ),
      );

      const mockTx = buildMockTx();
      const unitOfWork = {
        run: jest.fn(
          (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const identityPort = {
        lockIdentity: jest.fn().mockResolvedValue(undefined),
      } as unknown as IdentityPort;

      const useCase = new ArchiveStaffUseCase(
        staffRepo,
        userRepo,
        unitOfWork,
        identityPort,
      );

      await useCase.execute(STAFF_ID, CAMPUS_ID, buildActor());

      // Sanity: archive still does its actual job.
      expect(mockTx.updateStaff).toHaveBeenCalledWith(
        STAFF_ID,
        expect.objectContaining({ isArchived: true }),
      );
      expect(mockTx.updateUser).toHaveBeenCalledWith(USER_ID, {
        isActive: false,
      });
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);

      // D4 invariant — the contract this test exists for.
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
    });
  });

  describe("AC-11: RestoreStaffUseCase does not mutate user_roles", () => {
    it("runs the restore UoW closure without invoking any role-mutation port", async () => {
      const staffRepo = createMockStaffRepository();
      staffRepo.findById.mockResolvedValue(
        createStaff({
          id: STAFF_ID,
          campusId: CAMPUS_ID,
          fullName: "Dan Le",
          userId: USER_ID,
          isArchived: true,
        }),
      );

      const userRepo = createMockUserRepository();
      userRepo.findById.mockResolvedValue(
        User.reconstitute(
          {
            clerkUid: "user_clerk1234567",
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          USER_ID,
        ),
      );

      const mockTx = buildMockTx();
      const unitOfWork = {
        run: jest.fn(
          (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const identityPort = {
        unlockIdentity: jest.fn().mockResolvedValue(undefined),
      } as unknown as IdentityPort;

      const useCase = new RestoreStaffUseCase(
        staffRepo,
        userRepo,
        unitOfWork,
        identityPort,
      );

      await useCase.execute(STAFF_ID, CAMPUS_ID, buildActor());

      // Sanity: restore still does its actual job.
      expect(mockTx.updateStaff).toHaveBeenCalledWith(
        STAFF_ID,
        expect.objectContaining({ isArchived: false }),
      );
      expect(mockTx.updateUser).toHaveBeenCalledWith(USER_ID, {
        isActive: true,
      });
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);

      // D4 invariant.
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
    });
  });

  describe("AC-11: archive→restore round-trip never touches user_roles", () => {
    it("survives a full archive→restore cycle without any role mutation", async () => {
      const staffRepo = createMockStaffRepository();
      // Archive sees an active staff; restore sees the post-archive snapshot.
      staffRepo.findById
        .mockResolvedValueOnce(
          createStaff({
            id: STAFF_ID,
            campusId: CAMPUS_ID,
            fullName: "Dan Le",
            userId: USER_ID,
          }),
        )
        .mockResolvedValueOnce(
          createStaff({
            id: STAFF_ID,
            campusId: CAMPUS_ID,
            fullName: "Dan Le",
            userId: USER_ID,
            isArchived: true,
          }),
        );

      const userRepo = createMockUserRepository();
      userRepo.findById.mockResolvedValue(
        User.reconstitute(
          {
            clerkUid: "user_clerk1234567",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          USER_ID,
        ),
      );

      // One shared tx — both use-case runs accumulate calls on the same
      // spies, so the final assertion covers BOTH closures.
      const mockTx = buildMockTx();
      const unitOfWork = {
        run: jest.fn(
          (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
        ),
      } as unknown as UnitOfWorkPort;

      const identityPort = {
        lockIdentity: jest.fn().mockResolvedValue(undefined),
        unlockIdentity: jest.fn().mockResolvedValue(undefined),
      } as unknown as IdentityPort;

      const archive = new ArchiveStaffUseCase(
        staffRepo,
        userRepo,
        unitOfWork,
        identityPort,
      );
      const restore = new RestoreStaffUseCase(
        staffRepo,
        userRepo,
        unitOfWork,
        identityPort,
      );

      const actor = buildActor();
      await archive.execute(STAFF_ID, CAMPUS_ID, actor);
      await restore.execute(STAFF_ID, CAMPUS_ID, actor);

      // Both closures ran: two staff updates, two user updates, two audits.
      expect(mockTx.updateStaff).toHaveBeenCalledTimes(2);
      expect(mockTx.updateUser).toHaveBeenCalledTimes(2);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(2);

      // Across the entire round-trip: zero role mutations. In a real DB this
      // is what guarantees the auto-granted user_roles row is still present
      // and active after restore.
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // AC-12 — UpdateStaffTypeUseCase.defaultRoleId edit must not propagate
  //         to existing user_roles rows (Spec D1, Scenario 4)
  // -----------------------------------------------------------------
  describe("AC-12: UpdateStaffTypeUseCase.defaultRoleId edit does not propagate to user_roles", () => {
    const STAFF_TYPE_ID = "stype-1";
    const ROLE_NEW = "role-new";

    it("only persists the StaffType row; no transactional surface is reachable", async () => {
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
        exists: jest.fn().mockResolvedValue(true),
      } as unknown as jest.Mocked<RoleRepository>;

      const useCase = new UpdateStaffTypeUseCase(staffTypeRepo, roleRepo);

      await useCase.execute(STAFF_TYPE_ID, { defaultRoleId: ROLE_NEW });

      // The only persistence touch is the StaffType row itself — the new
      // defaultRoleId is set on the domain entity and saved.
      expect(staffTypeRepo.update).toHaveBeenCalledTimes(1);
      const persisted = staffTypeRepo.update.mock.calls[0]![0];
      expect(persisted.defaultRoleId).toBe(ROLE_NEW);

      // Validation-only port use: `exists` is a read, not a write.
      expect(roleRepo.exists).toHaveBeenCalledWith(ROLE_NEW);
    });

    it("has no UnitOfWork dependency — structural lock on D1", () => {
      // The use case constructor exposes only StaffTypeRepository and
      // RoleRepository. Any future change that adds resync logic would have
      // to inject a UnitOfWorkPort (no other path can reach user_roles) and
      // this assertion would break — flagging the regression at both compile
      // time (constructor arity) and test time.
      expect(UpdateStaffTypeUseCase.length).toBe(2);
    });
  });
});
