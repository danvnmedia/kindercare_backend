import { NotFoundException } from "@nestjs/common";

import { ArchiveStaffUseCase } from "./archive-staff.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
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

describe("ArchiveStaffUseCase", () => {
  let useCase: ArchiveStaffUseCase;
  let staffRepo: jest.Mocked<StaffRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    staffRepo = createMockStaffRepository();
    mockTx = {
      updateStaff: jest.fn().mockResolvedValue({ id: "staff-1" }),
      updateUser: jest.fn().mockResolvedValue({ id: "user-1" }),
      revokeRolesByProvenance: jest.fn().mockResolvedValue(2),
      revokeRoles: jest.fn().mockResolvedValue(0),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();

    useCase = new ArchiveStaffUseCase(staffRepo, unitOfWork);
  });

  describe("profile-scoped archive", () => {
    it("archives a linked staff profile and revokes only StaffType-derived grants", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        fullName: "Dan Le",
        userId: "user-1",
        staffTypes: [
          { id: "type-teacher", name: "Teacher" },
          { id: "type-lead", name: "Lead" },
        ],
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute("staff-1", CAMPUS_ID, actor);

      expect(mockTx.updateStaff).toHaveBeenCalledWith(
        "staff-1",
        expect.objectContaining({ isArchived: true }),
      );
      expect(mockTx.updateUser).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).toHaveBeenCalledWith("user-1", [
        "type-teacher",
        "type-lead",
      ]);
      expect(mockTx.revokeRoles).not.toHaveBeenCalled();

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("ARCHIVE_STAFF");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe("staff-1");
      expect(payload.campusId).toBe(CAMPUS_ID);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({ actorName: "Alice Nguyen" });
      expect(payload.beforeValue).toEqual({ isArchived: false });
      expect(payload.afterValue).toEqual({ isArchived: true });
    });

    it("does not revoke grants when linked staff has no StaffTypes", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: "user-1",
        staffTypes: [],
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute("staff-1", CAMPUS_ID, actor);

      expect(mockTx.updateUser).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });

    it("archives an unlinked staff profile", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: null,
      });
      staffRepo.findById.mockResolvedValue(staff);

      await useCase.execute("staff-1", CAMPUS_ID, actor);

      expect(mockTx.updateUser).not.toHaveBeenCalled();
      expect(mockTx.revokeRolesByProvenance).not.toHaveBeenCalled();
      expect(mockTx.updateStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit.mock.calls[0]![0].action).toBe("ARCHIVE_STAFF");
    });
  });

  describe("AC-4 — rollback when recorder throws", () => {
    it("propagates the recorder error after running the mutation inside the UoW", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        userId: null,
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

    it("throws NotFoundException when staff belongs to a different campus", async () => {
      const staff = createStaff({
        id: "staff-1",
        campusId: "22222222-2222-4222-a222-222222222222",
      });
      staffRepo.findById.mockResolvedValue(staff);

      await expect(
        useCase.execute("staff-1", CAMPUS_ID, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
