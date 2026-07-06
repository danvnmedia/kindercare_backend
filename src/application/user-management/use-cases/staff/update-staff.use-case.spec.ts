import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import { UpdateStaffUseCase } from "./update-staff.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { createStaff, createMockStaffRepository } from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";

// UUID-lex-stable type ids so audit assertions about sort order are
// deterministic regardless of caller-supplied input order. All three lex
// ASC as: TYPE_A < TYPE_B < TYPE_C.
const TYPE_A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const TYPE_B = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const TYPE_C = "cccccccc-cccc-4ccc-cccc-cccccccccccc";

const ROLE_A = "role-a";
const ROLE_B = "role-b";
const ROLE_C = "role-c";

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
 * Build a StaffType fixture for `staffTypeRepository.findById` returns.
 * Returned as `unknown` so callers cast inside `mockImplementation` with
 * `as never`, matching the pattern used in `create-staff.use-case.spec.ts`.
 */
function stype(overrides: {
  id: string;
  name?: string;
  defaultRoleId?: string | null;
  isArchived?: boolean;
  campusId?: string;
}): unknown {
  return {
    id: overrides.id,
    campusId: overrides.campusId ?? CAMPUS_ID,
    name: overrides.name ?? `StaffType-${overrides.id}`,
    defaultRoleId:
      overrides.defaultRoleId === undefined ? null : overrides.defaultRoleId,
    isArchived: overrides.isArchived ?? false,
  };
}

describe("UpdateStaffUseCase", () => {
  let useCase: UpdateStaffUseCase;
  let staffRepo: jest.Mocked<StaffRepository>;
  let staffTypeRepo: jest.Mocked<StaffTypeRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

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
    mockTx = {
      updateStaff: jest.fn().mockResolvedValue({ id: "staff-1" }),
      replaceStaffTypes: jest.fn().mockResolvedValue(undefined),
      assignRoles: jest.fn().mockResolvedValue(1),
      revokeRolesByProvenance: jest.fn().mockResolvedValue(0),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();

    useCase = new UpdateStaffUseCase(staffRepo, staffTypeRepo, unitOfWork);
  });

  describe("DB-only path (no User account)", () => {
    it("AC-3 — emits EDIT_STAFF_PROFILE with only changed fields", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        fullName: "Dan Le",
        address: null,
        userId: null,
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, address: "12 Pine St" },
        actor,
      );

      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.replaceStaffTypes).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);

      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("EDIT_STAFF_PROFILE");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe("staff-1");
      expect(payload.campusId).toBe(CAMPUS_ID);
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
        campusId: CAMPUS_ID,
        address: "12 Pine St",
        userId: null,
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, address: "12 Pine St" },
        actor,
      );

      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.replaceStaffTypes).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("omitted staffTypeIds: no replaceStaffTypes / no role mutation", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        address: null,
        userId: "user-1",
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, address: "9 Oak St" },
        actor,
      );

      expect(staffTypeRepo.findById).not.toHaveBeenCalled();
      expect(mockTx.replaceStaffTypes).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
    });
  });

  describe("linked identity field restrictions", () => {
    it("rejects linked staff email changes before DB writes", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        fullName: "Dan Le",
        email: "dan@example.com",
        userId: "user-1",
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);

      await expect(
        useCase.execute(
          "staff-1",
          { campusId: CAMPUS_ID, email: "dan.new@example.com" },
          actor,
        ),
      ).rejects.toThrow(ConflictException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.updateStaff).not.toHaveBeenCalled();
    });

    it("rejects linked staff phone and fullName changes", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        fullName: "Dan Le",
        phoneNumber: "+15550000001",
        userId: "user-1",
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);

      await expect(
        useCase.execute(
          "staff-1",
          {
            campusId: CAMPUS_ID,
            phoneNumber: "+15550000002",
            fullName: "Dan New",
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("AC-4 — audit failure on DB-only path", () => {
    it("propagates recorder error and ran updateStaff inside the UoW", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        address: null,
        userId: null,
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute(
          "staff-1",
          { campusId: CAMPUS_ID, address: "12 Pine St" },
          actor,
        ),
      ).rejects.toThrow("audit fail");

      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when staff does not exist", async () => {
      staffRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("missing", { campusId: CAMPUS_ID, fullName: "X" }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when staff belongs to a different campus", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: "22222222-2222-4222-a222-222222222222",
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);

      await expect(
        useCase.execute("staff-1", { campusId: CAMPUS_ID, fullName: "X" }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws ConflictException on duplicate email within the same campus", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        email: "old@example.com",
        userId: null,
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      const conflicting = createStaff({
        id: "staff-2",
        campusId: CAMPUS_ID,
        email: "new@example.com",
        userId: null,
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);
      staffRepo.findByEmailInCampus.mockResolvedValue(conflicting);

      await expect(
        useCase.execute(
          "staff-1",
          { campusId: CAMPUS_ID, email: "new@example.com" },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  // Set-diff staff-type swap inside EDIT_STAFF_PROFILE. Manual grants
  // (provenance NULL) must never be touched; tracked grants are revoked by
  // `(userId, removed)` and reissued under each added type's provenance.
  // See @doc/specs/staff-multi-type-refactor §Scenarios 2/3/7 and D-extra-3.
  describe("set-diff staff-type swap", () => {
    const USER_ID = "user-1";

    function makeStaff(staffTypes: { id: string; name: string }[]) {
      return createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        staffTypes,
        userId: USER_ID,
      });
    }

    it("Scenario 2 — [A,B] → [A,C]: revokes B-provenance, assigns C-provenance, UUID-lex audit", async () => {
      const staff = makeStaff([
        { id: TYPE_A, name: "Teacher" },
        { id: TYPE_B, name: "Nurse" },
      ]);
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockImplementation(
        async (id: string) =>
          (id === TYPE_C
            ? stype({ id: TYPE_C, name: "VicePresident", defaultRoleId: ROLE_C })
            : id === TYPE_B
              ? stype({ id: TYPE_B, name: "Nurse", defaultRoleId: ROLE_B })
              : null) as never,
      );

      // Caller submits the new set in arbitrary order — pre-sort guarantees
      // the audit's `staffTypeIds` array is UUID-lex sorted regardless.
      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeIds: [TYPE_C, TYPE_A] },
        actor,
      );

      expect(mockTx.replaceStaffTypes).toHaveBeenCalledWith("staff-1", [
        TYPE_C,
        TYPE_A,
      ]);
      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith(USER_ID, [
        TYPE_B,
      ]);
      expect(mockTx.assignRoles).toHaveBeenCalledWith(USER_ID, [
        {
          roleId: ROLE_C,
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: TYPE_C,
        },
      ]);

      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.beforeValue).toEqual({ staffTypeIds: [TYPE_A, TYPE_B] });
      expect(payload.afterValue).toEqual({ staffTypeIds: [TYPE_A, TYPE_C] });
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [{ roleId: ROLE_C, viaStaffTypeId: TYPE_C }],
        rolesRevoked: [{ roleId: ROLE_B, viaStaffTypeId: TYPE_B }],
      });
    });

    it("Scenario 3 — same set in different order: replaceStaffTypes runs, no role mutation, no audit", async () => {
      const staff = makeStaff([
        { id: TYPE_A, name: "Teacher" },
        { id: TYPE_B, name: "Nurse" },
      ]);
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeIds: [TYPE_B, TYPE_A] },
        actor,
      );

      // Idempotent delete+recreate at the table level still fires.
      expect(mockTx.replaceStaffTypes).toHaveBeenCalledWith("staff-1", [
        TYPE_B,
        TYPE_A,
      ]);
      // No diff in either set → no per-type validation needed.
      expect(staffTypeRepo.findById).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      // computeDiff sees identical UUID-lex-sorted arrays → no audit emit.
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("Scenario 7 — staff.userId = null: replaceStaffTypes runs, role arrays empty, audit emits", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: null,
        staffTypes: [{ id: TYPE_A, name: "Teacher" }],
      });
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockImplementation(
        async (id: string) =>
          stype({ id, name: "Nurse", defaultRoleId: ROLE_B }) as never,
      );

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeIds: [TYPE_B] },
        actor,
      );

      expect(mockTx.replaceStaffTypes).toHaveBeenCalledWith("staff-1", [TYPE_B]);
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).not.toHaveBeenCalled();

      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.beforeValue).toEqual({ staffTypeIds: [TYPE_A] });
      expect(payload.afterValue).toEqual({ staffTypeIds: [TYPE_B] });
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [],
        rolesRevoked: [],
      });
    });

    it("D-extra-3 — two added types sharing the same defaultRoleId produce two assignRoles entries", async () => {
      const staff = makeStaff([{ id: TYPE_A, name: "Existing" }]);
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockImplementation(
        async (id: string) =>
          stype({ id, defaultRoleId: ROLE_B }) as never,
      );

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeIds: [TYPE_A, TYPE_B, TYPE_C] },
        actor,
      );

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      const [userIdArg, assignments] = mockTx.assignRoles.mock.calls[0]!;
      expect(userIdArg).toBe(USER_ID);
      expect(assignments).toEqual([
        { roleId: ROLE_B, campusId: CAMPUS_ID, grantedViaStaffTypeId: TYPE_B },
        { roleId: ROLE_B, campusId: CAMPUS_ID, grantedViaStaffTypeId: TYPE_C },
      ]);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        rolesGranted: [
          { roleId: ROLE_B, viaStaffTypeId: TYPE_B },
          { roleId: ROLE_B, viaStaffTypeId: TYPE_C },
        ],
        rolesRevoked: [],
      });
    });

    it("D5 retired — assignRoles returns 0, rolesGranted is STILL populated (count guard removed)", async () => {
      // Under the 4-col NULLS NOT DISTINCT unique key, the only way an
      // insert can be silently skipped is a duplicate `(userId, roleId,
      // campusId, grantedViaStaffTypeId)` tuple — which the set-diff
      // mathematically excludes. But we still drop the count guard so the
      // audit row stays faithful to the IDs the caller asked us to grant
      // regardless of the count returned.
      const staff = makeStaff([{ id: TYPE_A, name: "Teacher" }]);
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockImplementation(
        async (id: string) =>
          stype({ id, defaultRoleId: ROLE_B }) as never,
      );
      mockTx.assignRoles.mockResolvedValueOnce(0);

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeIds: [TYPE_A, TYPE_B] },
        actor,
      );

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context.rolesGranted).toEqual([
        { roleId: ROLE_B, viaStaffTypeId: TYPE_B },
      ]);
    });

    it("added type with defaultRoleId=null: no insert", async () => {
      const staff = makeStaff([{ id: TYPE_A, name: "Teacher" }]);
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockImplementation(
        async (id: string) => stype({ id, defaultRoleId: null }) as never,
      );

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeIds: [TYPE_A, TYPE_B] },
        actor,
      );

      expect(mockTx.replaceStaffTypes).toHaveBeenCalledWith("staff-1", [
        TYPE_A,
        TYPE_B,
      ]);
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context.rolesGranted).toEqual([]);
    });

    it("removed type with defaultRoleId=null: revoke fires by id, audit entry omitted", async () => {
      const staff = makeStaff([
        { id: TYPE_A, name: "Teacher" },
        { id: TYPE_B, name: "Nurse" },
      ]);
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockImplementation(
        async (id: string) =>
          (id === TYPE_B
            ? stype({ id: TYPE_B, defaultRoleId: null })
            : null) as never,
      );

      await useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeIds: [TYPE_A] },
        actor,
      );

      // The join row + tracked grant are cleaned up by id regardless of
      // whether we can audit-name the role.
      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith(USER_ID, [
        TYPE_B,
      ]);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context.rolesRevoked).toEqual([]);
    });
  });

  describe("pre-UoW validation (added side only)", () => {
    function staffWithType(typeId: string) {
      return createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: "user-1",
        staffTypes: [{ id: typeId, name: "Existing" }],
      });
    }

    it("throws NotFoundException when an added type does not exist", async () => {
      staffRepo.findById.mockResolvedValue(staffWithType(TYPE_A));
      staffTypeRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          "staff-1",
          { campusId: CAMPUS_ID, staffTypeIds: [TYPE_A, TYPE_B] },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when an added type is archived", async () => {
      staffRepo.findById.mockResolvedValue(staffWithType(TYPE_A));
      staffTypeRepo.findById.mockResolvedValue(
        stype({ id: TYPE_B, isArchived: true }) as never,
      );

      await expect(
        useCase.execute(
          "staff-1",
          { campusId: CAMPUS_ID, staffTypeIds: [TYPE_A, TYPE_B] },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when an added type belongs to a different campus", async () => {
      staffRepo.findById.mockResolvedValue(staffWithType(TYPE_A));
      staffTypeRepo.findById.mockResolvedValue(
        stype({
          id: TYPE_B,
          campusId: "22222222-2222-4222-a222-222222222222",
        }) as never,
      );

      await expect(
        useCase.execute(
          "staff-1",
          { campusId: CAMPUS_ID, staffTypeIds: [TYPE_A, TYPE_B] },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("second-of-many added type invalid still throws (loop iterates all)", async () => {
      staffRepo.findById.mockResolvedValue(staffWithType(TYPE_A));
      staffTypeRepo.findById.mockImplementation(async (id: string) =>
        id === TYPE_B
          ? (stype({ id: TYPE_B, defaultRoleId: ROLE_B }) as never)
          : (null as never),
      );

      await expect(
        useCase.execute(
          "staff-1",
          { campusId: CAMPUS_ID, staffTypeIds: [TYPE_A, TYPE_B, TYPE_C] },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
