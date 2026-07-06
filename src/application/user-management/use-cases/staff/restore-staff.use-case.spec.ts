import { BadRequestException, NotFoundException } from "@nestjs/common";

import { RestoreStaffUseCase } from "./restore-staff.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { createStaff, createMockStaffRepository } from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";

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

function buildStaffType(
  id: string,
  defaultRoleId: string | null,
  overrides: Partial<{ isArchived: boolean; campusId: string }> = {},
): StaffType {
  return StaffType.create(
    {
      campusId: overrides.campusId ?? CAMPUS_ID,
      name: id,
      order: 1,
      defaultRoleId,
      isArchived: overrides.isArchived ?? false,
    },
    id,
  );
}

describe("RestoreStaffUseCase", () => {
  let useCase: RestoreStaffUseCase;
  let staffRepo: jest.Mocked<StaffRepository>;
  let staffTypeRepo: jest.Mocked<StaffTypeRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    staffRepo = createMockStaffRepository();
    staffTypeRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StaffTypeRepository>;
    mockTx = {
      updateStaff: jest.fn().mockResolvedValue({ id: "staff-1" }),
      updateUser: jest.fn().mockResolvedValue({ id: "user-1" }),
      assignRoles: jest.fn().mockResolvedValue(2),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();

    useCase = new RestoreStaffUseCase(staffRepo, staffTypeRepo, unitOfWork);
  });

  describe("profile-scoped restore", () => {
    it("restores a linked staff profile and recreates active StaffType-derived grants", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        fullName: "Dan Le",
        userId: "user-1",
        isArchived: true,
        staffTypes: [
          { id: "type-teacher", name: "Teacher" },
          { id: "type-no-role", name: "No Role" },
          { id: "type-archived", name: "Archived" },
          { id: "type-other-campus", name: "Other Campus" },
        ],
      });
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockImplementation(async (id) => {
        if (id === "type-teacher") {
          return buildStaffType("type-teacher", "role-teacher");
        }
        if (id === "type-no-role") {
          return buildStaffType("type-no-role", null);
        }
        if (id === "type-archived") {
          return buildStaffType("type-archived", "role-archived", {
            isArchived: true,
          });
        }
        if (id === "type-other-campus") {
          return buildStaffType("type-other-campus", "role-other", {
            campusId: "22222222-2222-4222-a222-222222222222",
          });
        }
        return null;
      });

      await useCase.execute("staff-1", CAMPUS_ID, actor);

      expect(mockTx.updateStaff).toHaveBeenCalledWith(
        "staff-1",
        expect.objectContaining({ isArchived: false }),
      );
      expect(mockTx.updateUser).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).toHaveBeenCalledWith("user-1", [
        {
          roleId: "role-teacher",
          campusId: CAMPUS_ID,
          grantedViaStaffTypeId: "type-teacher",
        },
      ]);

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("RESTORE_STAFF");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe("staff-1");
      expect(payload.campusId).toBe(CAMPUS_ID);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({ actorName: "Alice Nguyen" });
      expect(payload.beforeValue).toEqual({ isArchived: true });
      expect(payload.afterValue).toEqual({ isArchived: false });
    });

    it("does not assign roles when linked staff has no active default-role StaffTypes", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: "user-1",
        isArchived: true,
        staffTypes: [{ id: "type-no-role", name: "No Role" }],
      });
      staffRepo.findById.mockResolvedValue(staff);
      staffTypeRepo.findById.mockResolvedValue(
        buildStaffType("type-no-role", null),
      );

      await useCase.execute("staff-1", CAMPUS_ID, actor);

      expect(mockTx.updateUser).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });

    it("restores an unlinked staff profile", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: null,
        isArchived: true,
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute("staff-1", CAMPUS_ID, actor);

      expect(mockTx.updateUser).not.toHaveBeenCalled();
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit.mock.calls[0]![0].action).toBe("RESTORE_STAFF");
    });
  });

  describe("AC-4 — rollback when recorder throws", () => {
    it("propagates the recorder error after running the mutation inside the UoW", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: null,
        isArchived: true,
      });
      staffRepo.findById.mockResolvedValue(staff);
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute("staff-1", CAMPUS_ID, actor),
      ).rejects.toThrow("audit fail");

      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when staff does not exist", async () => {
      staffRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("missing", CAMPUS_ID, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when staff is not archived", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        isArchived: false,
      });
      staffRepo.findById.mockResolvedValue(staff);

      await expect(
        useCase.execute("staff-1", CAMPUS_ID, actor),
      ).rejects.toThrow(BadRequestException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when staff belongs to a different campus", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: "22222222-2222-4222-a222-222222222222",
        isArchived: true,
      });
      staffRepo.findById.mockResolvedValue(staff);

      await expect(
        useCase.execute("staff-1", CAMPUS_ID, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
