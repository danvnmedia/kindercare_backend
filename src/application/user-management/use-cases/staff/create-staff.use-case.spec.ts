import { BadRequestException, ConflictException } from "@nestjs/common";

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
  };

  beforeEach(() => {
    staffRepo = createMockStaffRepository();
    staffTypeRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StaffTypeRepository>;
    mockTx = {
      createUser: jest
        .fn()
        .mockResolvedValue({ id: "user-1", clerkUid: "user_new123" }),
      createStaff: jest.fn().mockResolvedValue({ id: "staff-1" }),
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

  describe("AC-3 — happy path emits CREATE_STAFF inside UoW", () => {
    it("provisions Clerk, creates user + staff, and records audit with name + code", async () => {
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

  describe("AC-4 — rollback compensates Clerk when audit throws", () => {
    it("propagates the recorder error and deletes the provisioned Clerk user", async () => {
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockTx.createStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
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

  // Provenance is what lets a later staff-type change selectively revoke the
  // auto-granted role row without touching manual grants — see
  // @doc/specs/tracked-grant-revocation (D5 manual-wins, Scenario 1).
  describe("provenance on auto-granted default role", () => {
    const STAFF_TYPE_ID = "stype-1";
    const DEFAULT_ROLE_ID = "role-X";

    it("passes grantedViaStaffTypeId on the role row when staffType has a defaultRoleId", async () => {
      staffTypeRepo.findById.mockResolvedValueOnce({
        id: STAFF_TYPE_ID,
        campusId: CAMPUS_ID,
        name: "Teacher",
        defaultRoleId: DEFAULT_ROLE_ID,
        isArchived: false,
      } as never);

      await useCase.execute(
        { ...validInput, staffTypeId: STAFF_TYPE_ID },
        actor,
      );

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      expect(mockTx.assignRoles).toHaveBeenCalledWith("user-1", [
        {
          roleId: DEFAULT_ROLE_ID,
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: STAFF_TYPE_ID,
        },
      ]);
    });

    it("does not call assignRoles when staffType has a null defaultRoleId", async () => {
      staffTypeRepo.findById.mockResolvedValueOnce({
        id: STAFF_TYPE_ID,
        campusId: CAMPUS_ID,
        name: "AdminAssistant",
        defaultRoleId: null,
        isArchived: false,
      } as never);

      await useCase.execute(
        { ...validInput, staffTypeId: STAFF_TYPE_ID },
        actor,
      );

      // No auto-grant row is inserted at all — preserves the D2 "no historical
      // reconstruction" invariant: nothing implicit, nothing to clean up later.
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      // Staff + user + audit still committed in the same UoW.
      expect(mockTx.createStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });

    it("does not call assignRoles when no staffTypeId is supplied", async () => {
      await useCase.execute(validInput, actor);

      // StaffType validation step is skipped entirely; no role row.
      expect(staffTypeRepo.findById).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
    });
  });
});
