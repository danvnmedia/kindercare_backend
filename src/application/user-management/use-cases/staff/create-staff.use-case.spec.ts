import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";

import { CreateStaffUseCase } from "./create-staff.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { StaffCodeGeneratorPort } from "@/application/ports/staff-code-generator.port";
import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { createMockStaffRepository } from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const STAFF_CODE = "ST-2026-000042";
const TYPE_TEACHER = "stype-teacher";
const TYPE_VICE_PRESIDENT = "stype-vp";
const ROLE_STAFF = "role-staff";

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
 * Test fixture for the StaffType repository hit during pre-UoW validation.
 * Returns shape compatible with `StaffType` entity reads consumed by the
 * use case (`id`, `campusId`, `name`, `defaultRoleId`, `isArchived`).
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

describe("CreateStaffUseCase", () => {
  let useCase: CreateStaffUseCase;
  let staffRepo: jest.Mocked<StaffRepository>;
  let staffTypeRepo: jest.Mocked<StaffTypeRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let identityPort: jest.Mocked<IdentityPort>;
  let codeGenerator: jest.Mocked<StaffCodeGeneratorPort>;
  let actor: User;

  const validInput = {
    campusId: CAMPUS_ID,
    fullName: "Dan Le",
    email: "dan@example.com",
    phoneNumber: "+84900000002",
    staffTypeIds: [TYPE_TEACHER],
  };

  beforeEach(() => {
    staffRepo = createMockStaffRepository();
    staffTypeRepo = {
      findById: jest.fn().mockImplementation(async (id: string) =>
        stype({ id, defaultRoleId: ROLE_STAFF }),
      ),
    } as unknown as jest.Mocked<StaffTypeRepository>;
    mockTx = {
      createUser: jest
        .fn()
        .mockResolvedValue({ id: "user-1", clerkUid: "user_new123" }),
      createStaff: jest.fn().mockResolvedValue({ id: "staff-1" }),
      replaceStaffTypes: jest.fn().mockResolvedValue(undefined),
      assignRoles: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    identityPort = {
      provisionUser: jest.fn().mockResolvedValue({ clerkUid: "user_new123" }),
      deleteIdentity: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IdentityPort>;
    codeGenerator = {
      generateNextCode: jest.fn().mockResolvedValue(STAFF_CODE),
    } as unknown as jest.Mocked<StaffCodeGeneratorPort>;
    actor = buildActor();

    useCase = new CreateStaffUseCase(
      staffRepo,
      staffTypeRepo,
      unitOfWork,
      identityPort,
      codeGenerator,
    );
  });

  describe("happy path — single type", () => {
    it("provisions Clerk, creates user + staff + join row, and records CREATE_STAFF audit", async () => {
      const staff = await useCase.execute(validInput, actor);

      expect(identityPort.provisionUser).toHaveBeenCalledTimes(1);
      expect(codeGenerator.generateNextCode).toHaveBeenCalledWith(CAMPUS_ID);
      expect(mockTx.createUser).toHaveBeenCalledWith({
        clerkUid: "user_new123",
        isActive: true,
      });
      expect(mockTx.createStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          staffCode: STAFF_CODE,
          fullName: "Dan Le",
          userId: "user-1",
        }),
      );
      // tx.createStaff payload must NOT carry the legacy `staffTypeId` field
      // — schema column was dropped by 1chp85 / port trimmed by nnbbtb.
      const createStaffPayload = mockTx.createStaff.mock.calls[0]![0];
      expect(createStaffPayload).not.toHaveProperty("staffTypeId");

      // Join set is written via replaceStaffTypes — full-set, idempotent.
      expect(mockTx.replaceStaffTypes).toHaveBeenCalledTimes(1);
      expect(mockTx.replaceStaffTypes).toHaveBeenCalledWith(staff.id, [
        TYPE_TEACHER,
      ]);

      // Hydrated entity surfaces the snapshot — interceptor projects {id,name}.
      expect(staff.staffTypes).toHaveLength(1);
      expect(staff.staffTypes[0]).toMatchObject({
        id: TYPE_TEACHER,
        name: `StaffType-${TYPE_TEACHER}`,
      });

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("CREATE_STAFF");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe(staff.id);
      expect(payload.campusId).toBe(CAMPUS_ID);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        name: "Dan Le",
        code: STAFF_CODE,
      });
    });
  });

  describe("AC-13 / D-extra-3 — per-provenance role grant materialization", () => {
    it("two types sharing defaultRoleId produce 2 user_roles rows with distinct provenance", async () => {
      // Scenario 1 of @doc/specs/staff-multi-type-refactor: both types map
      // to ROLE_STAFF. Each gets its own row keyed by `grantedViaStaffTypeId`
      // so a later swap can revoke each independently. The 4-col unique
      // (D2) with NULLS NOT DISTINCT permits both to coexist alongside a
      // potential manual NULL-provenance row for the same (user, role,
      // campus).
      staffTypeRepo.findById.mockImplementation(
        async (id: string) =>
          stype({
            id,
            name: id === TYPE_TEACHER ? "Teacher" : "Vice President",
            defaultRoleId: ROLE_STAFF,
          }) as never,
      );

      await useCase.execute(
        {
          ...validInput,
          staffTypeIds: [TYPE_TEACHER, TYPE_VICE_PRESIDENT],
        },
        actor,
      );

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      expect(mockTx.assignRoles).toHaveBeenCalledWith("user-1", [
        {
          roleId: ROLE_STAFF,
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: TYPE_TEACHER,
        },
        {
          roleId: ROLE_STAFF,
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: TYPE_VICE_PRESIDENT,
        },
      ]);
      // Join set is written in input order; ordering for display by
      // `StaffType.order` is the responsibility of the read mapper, not
      // the use case.
      expect(mockTx.replaceStaffTypes).toHaveBeenCalledWith(expect.any(String), [
        TYPE_TEACHER,
        TYPE_VICE_PRESIDENT,
      ]);
    });

    it("emits one provenance entry per type even when only some have defaultRoleId", async () => {
      // Mixed: TYPE_TEACHER has a default role, TYPE_VICE_PRESIDENT does not.
      // Only the type with a non-null defaultRoleId produces an assignRoles
      // entry — the other is silently filtered out (no implicit reconstruction
      // per D2 of @doc/specs/tracked-grant-revocation).
      staffTypeRepo.findById.mockImplementation(
        async (id: string) =>
          stype({
            id,
            defaultRoleId: id === TYPE_TEACHER ? ROLE_STAFF : null,
          }) as never,
      );

      await useCase.execute(
        {
          ...validInput,
          staffTypeIds: [TYPE_TEACHER, TYPE_VICE_PRESIDENT],
        },
        actor,
      );

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      expect(mockTx.assignRoles).toHaveBeenCalledWith("user-1", [
        {
          roleId: ROLE_STAFF,
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: TYPE_TEACHER,
        },
      ]);
    });

    it("all-types-with-null-defaultRoleId: skips assignRoles entirely, still persists staff + join + audit", async () => {
      staffTypeRepo.findById.mockImplementation(
        async (id: string) => stype({ id, defaultRoleId: null }) as never,
      );

      await useCase.execute(
        {
          ...validInput,
          staffTypeIds: [TYPE_TEACHER, TYPE_VICE_PRESIDENT],
        },
        actor,
      );

      // No `user_roles` rows inserted — preserves D2's "no historical
      // reconstruction" invariant: nothing implicit to clean up later.
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      // Staff + join + audit still committed in the same UoW.
      expect(mockTx.createStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.replaceStaffTypes).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("pre-UoW staff-type validation", () => {
    it("throws NotFoundException when a type ID does not exist", async () => {
      staffTypeRepo.findById.mockResolvedValueOnce(null);

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        NotFoundException,
      );

      expect(identityPort.provisionUser).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when a type is archived", async () => {
      staffTypeRepo.findById.mockResolvedValueOnce(
        stype({ id: TYPE_TEACHER, isArchived: true }) as never,
      );

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        BadRequestException,
      );

      expect(identityPort.provisionUser).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when a type belongs to a different campus", async () => {
      staffTypeRepo.findById.mockResolvedValueOnce(
        stype({
          id: TYPE_TEACHER,
          campusId: "22222222-2222-4222-a222-222222222222",
        }) as never,
      );

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        BadRequestException,
      );

      expect(identityPort.provisionUser).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("validates every supplied type — the second type being invalid still fails the call", async () => {
      // First lookup OK, second archived. Pre-UoW loop must iterate every
      // entry; the use case must NOT shortcut on the first valid hit.
      staffTypeRepo.findById
        .mockResolvedValueOnce(
          stype({ id: TYPE_TEACHER, defaultRoleId: ROLE_STAFF }) as never,
        )
        .mockResolvedValueOnce(
          stype({ id: TYPE_VICE_PRESIDENT, isArchived: true }) as never,
        );

      await expect(
        useCase.execute(
          {
            ...validInput,
            staffTypeIds: [TYPE_TEACHER, TYPE_VICE_PRESIDENT],
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(staffTypeRepo.findById).toHaveBeenCalledTimes(2);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("Clerk saga compensation on UoW failure", () => {
    it("propagates audit failure and deletes the provisioned Clerk user", async () => {
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockTx.createStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.replaceStaffTypes).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      expect(identityPort.deleteIdentity).toHaveBeenCalledWith("user_new123");
    });

    it("compensation fires when replaceStaffTypes throws inside the UoW", async () => {
      // Failure point sits between createStaff and the role grant — confirms
      // the saga rolls back regardless of which UoW step throws.
      mockTx.replaceStaffTypes.mockRejectedValue(new Error("join row insert fail"));

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        BadRequestException,
      );

      expect(identityPort.deleteIdentity).toHaveBeenCalledWith("user_new123");
    });
  });

  describe("existing semantics preserved", () => {
    it("throws ConflictException when email already exists in campus", async () => {
      staffRepo.findByEmailInCampus.mockResolvedValueOnce({
        id: "existing",
      } as never);

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        ConflictException,
      );
      expect(identityPort.provisionUser).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
