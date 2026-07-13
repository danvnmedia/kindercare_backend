import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { GuardianRepository } from "../../ports/guardian.repository";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";
import {
  createGuardian,
  createMockGuardianRepository,
  createMockStaffRepository,
  createMockUserRepository,
  createRole,
  createRoleAssignment,
  createStaff,
  createUser,
} from "@/test-utils";
import { DeleteGlobalIdentityUseCase } from "./delete-global-identity.use-case";
import { GLOBAL_IDENTITY_AUDIT_CAMPUS_ID } from "./global-identity-admin.policy";
import { LockGlobalIdentityUseCase } from "./lock-global-identity.use-case";
import { UnlockGlobalIdentityUseCase } from "./unlock-global-identity.use-case";

const TARGET_ID = "11111111-1111-4111-a111-111111111111";
const ACTOR_ID = "22222222-2222-4222-a222-222222222222";
const CAMPUS_ID = "33333333-3333-4333-a333-333333333333";

function buildGlobalAdmin() {
  const role = createRole({
    id: "role-super",
    name: "Super Admin",
    isSystemRole: true,
    campusId: null,
  });

  return createUser({
    id: ACTOR_ID,
    roleAssignments: [createRoleAssignment(role, null)],
    profile: {
      type: "staff",
      id: "staff-actor",
      campusId: CAMPUS_ID,
      fullName: "Alice Admin",
      email: null,
      phoneNumber: null,
      dateOfBirth: null,
      gender: null,
    },
  });
}

function buildCampusSystemAdmin() {
  const role = createRole({
    id: "role-campus-system",
    name: "Campus System",
    isSystemRole: true,
    campusId: null,
  });

  return createUser({
    id: ACTOR_ID,
    roleAssignments: [createRoleAssignment(role, CAMPUS_ID)],
  });
}

describe("global identity admin use cases", () => {
  let userRepo: jest.Mocked<UserRepository>;
  let staffRepo: jest.Mocked<StaffRepository>;
  let guardianRepo: jest.Mocked<GuardianRepository>;
  let identityPort: jest.Mocked<IdentityPort>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;

  beforeEach(() => {
    userRepo = createMockUserRepository();
    staffRepo = createMockStaffRepository();
    guardianRepo = createMockGuardianRepository();
    identityPort = {
      provisionUser: jest.fn(),
      updateUser: jest.fn(),
      deleteIdentity: jest.fn().mockResolvedValue(undefined),
      inviteUser: jest.fn(),
      lockIdentity: jest.fn().mockResolvedValue(undefined),
      unlockIdentity: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IdentityPort>;
    mockTx = {
      updateUser: jest.fn().mockResolvedValue({ id: TARGET_ID }),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
  });

  it("locks Clerk identity, deactivates User, and records an audit row", async () => {
    const target = createUser({
      id: TARGET_ID,
      clerkUid: "user_target",
      isActive: true,
    });
    userRepo.findById.mockResolvedValue(target);

    const useCase = new LockGlobalIdentityUseCase(
      userRepo,
      identityPort,
      unitOfWork,
    );

    await useCase.execute(TARGET_ID, buildGlobalAdmin());

    expect(identityPort.lockIdentity).toHaveBeenCalledWith("user_target");
    expect(mockTx.updateUser).toHaveBeenCalledWith(TARGET_ID, {
      isActive: false,
    });
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        action: "LOCK_GLOBAL_IDENTITY",
        targetType: "user",
        targetId: TARGET_ID,
        campusId: GLOBAL_IDENTITY_AUDIT_CAMPUS_ID,
        beforeValue: { isActive: true },
        afterValue: { isActive: false },
      }),
    );
  });

  it("unlocks Clerk identity, activates User, and records an audit row without restoring profiles", async () => {
    const target = createUser({
      id: TARGET_ID,
      clerkUid: "user_target",
      isActive: false,
      profiles: [],
    });
    userRepo.findById.mockResolvedValue(target);

    const useCase = new UnlockGlobalIdentityUseCase(
      userRepo,
      identityPort,
      unitOfWork,
    );

    await useCase.execute(TARGET_ID, buildGlobalAdmin());

    expect(identityPort.unlockIdentity).toHaveBeenCalledWith("user_target");
    expect(mockTx.updateUser).toHaveBeenCalledWith(TARGET_ID, {
      isActive: true,
    });
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UNLOCK_GLOBAL_IDENTITY",
        beforeValue: { isActive: false },
        afterValue: { isActive: true },
      }),
    );
    expect(target.profiles).toEqual([]);
  });

  it("rejects non-global-system-role callers before identity operations", async () => {
    const useCase = new LockGlobalIdentityUseCase(
      userRepo,
      identityPort,
      unitOfWork,
    );

    await expect(
      useCase.execute(TARGET_ID, buildCampusSystemAdmin()),
    ).rejects.toThrow(ForbiddenException);

    expect(userRepo.findById).not.toHaveBeenCalled();
    expect(identityPort.lockIdentity).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when the target identity does not exist", async () => {
    userRepo.findById.mockResolvedValue(null);
    const useCase = new LockGlobalIdentityUseCase(
      userRepo,
      identityPort,
      unitOfWork,
    );

    await expect(
      useCase.execute(TARGET_ID, buildGlobalAdmin()),
    ).rejects.toThrow(NotFoundException);

    expect(identityPort.lockIdentity).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it.each([
    [
      "archived staff",
      () =>
        createStaff({
          id: "staff-linked",
          userId: TARGET_ID,
          isArchived: true,
        }),
      null,
    ],
    [
      "active guardian",
      null,
      () =>
        createGuardian({
          id: "guardian-linked",
          userId: TARGET_ID,
          isArchived: false,
        }),
    ],
  ])(
    "refuses global identity delete while a linked %s profile remains",
    async (_caseName, staffFactory, guardianFactory) => {
      userRepo.findById.mockResolvedValue(
        createUser({ id: TARGET_ID, clerkUid: "user_target" }),
      );
      staffRepo.findByUserId.mockResolvedValue(staffFactory?.() ?? null);
      guardianRepo.findByUserId.mockResolvedValue(guardianFactory?.() ?? null);
      const useCase = new DeleteGlobalIdentityUseCase(
        userRepo,
        staffRepo,
        guardianRepo,
        identityPort,
        unitOfWork,
      );

      await expect(
        useCase.execute(TARGET_ID, buildGlobalAdmin()),
      ).rejects.toThrow(ConflictException);

      expect(identityPort.deleteIdentity).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    },
  );

  it("deletes Clerk and internal User only after no profiles remain linked", async () => {
    userRepo.findById.mockResolvedValue(
      createUser({ id: TARGET_ID, clerkUid: "user_target", isActive: false }),
    );
    staffRepo.findByUserId.mockResolvedValue(null);
    guardianRepo.findByUserId.mockResolvedValue(null);
    const useCase = new DeleteGlobalIdentityUseCase(
      userRepo,
      staffRepo,
      guardianRepo,
      identityPort,
      unitOfWork,
    );

    await useCase.execute(TARGET_ID, buildGlobalAdmin());

    expect(identityPort.deleteIdentity).toHaveBeenCalledWith("user_target");
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE_GLOBAL_IDENTITY",
        targetType: "user",
        targetId: TARGET_ID,
        beforeValue: { isActive: false },
        afterValue: null,
      }),
    );
    expect(mockTx.deleteUser).toHaveBeenCalledWith(TARGET_ID);
  });
});
