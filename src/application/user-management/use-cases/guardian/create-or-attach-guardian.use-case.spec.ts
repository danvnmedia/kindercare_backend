import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { IdentityPort } from "@/application/ports/identity.port";
import { TransactionContext } from "@/application/ports/unit-of-work.port";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";
import {
  createGuardian,
  createMockGuardianRepository,
  createMockUserRepository,
  createUser,
} from "@/test-utils";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";
import {
  CreateOrAttachGuardianErrorCode,
  CreateOrAttachGuardianResultStatus,
  CreateOrAttachGuardianUseCase,
} from "./create-or-attach-guardian.use-case";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";

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

describe("CreateOrAttachGuardianUseCase", () => {
  let useCase: CreateOrAttachGuardianUseCase;
  let guardianRepo: jest.Mocked<GuardianRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let identityPort: jest.Mocked<IdentityPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  const validInput = {
    campusId: CAMPUS_ID,
    fullName: "Carol Pham",
    email: "CAROL@example.com",
    phoneNumber: "+84900000001",
    gender: Gender.FEMALE,
  };

  beforeEach(() => {
    guardianRepo = createMockGuardianRepository();
    userRepo = createMockUserRepository();
    mockTx = {
      createUser: jest
        .fn()
        .mockResolvedValue({ id: "user-new", clerkUid: "user_new123" }),
      createGuardian: jest.fn().mockResolvedValue({ id: "guardian-new" }),
      updateGuardian: jest.fn().mockResolvedValue({ id: "guardian-1" }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    identityPort = {
      provisionUser: jest.fn().mockResolvedValue({ clerkUid: "user_new123" }),
      findIdentitiesByEmail: jest.fn().mockResolvedValue([]),
      findIdentitiesByPhoneNumber: jest.fn().mockResolvedValue([]),
      deleteIdentity: jest.fn().mockResolvedValue(undefined),
      updateUser: jest.fn(),
      inviteUser: jest.fn(),
      lockIdentity: jest.fn(),
      unlockIdentity: jest.fn(),
    } as unknown as jest.Mocked<IdentityPort>;
    actor = buildActor();

    userRepo.findManyByEmail.mockResolvedValue([]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([]);
    userRepo.findByClerkUid.mockResolvedValue(null);
    guardianRepo.findByEmailInCampus.mockResolvedValue(null);
    guardianRepo.findByPhoneNumberInCampus.mockResolvedValue(null);
    guardianRepo.findAnyByUserIdInCampus.mockResolvedValue(null);

    useCase = new CreateOrAttachGuardianUseCase(
      guardianRepo,
      userRepo,
      unitOfWork,
      identityPort,
    );
  });

  it("creates a new identity and selected-campus guardian when no identifier matches", async () => {
    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachGuardianResultStatus.CREATED_NEW_ACCOUNT,
    );
    expect(identityPort.provisionUser).toHaveBeenCalledWith({
      email: "carol@example.com",
      fullName: "Carol Pham",
      phoneNumber: "+84900000001",
      password: "ChangeMe123!",
    });
    expect(mockTx.createUser).toHaveBeenCalledWith({
      clerkUid: "user_new123",
      isActive: true,
    });
    expect(mockTx.createGuardian).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: CAMPUS_ID,
        email: "carol@example.com",
        userId: "user-new",
      }),
    );
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_GUARDIAN",
        targetType: "guardian",
        campusId: CAMPUS_ID,
      }),
    );
  });

  it("attaches a new guardian profile to a safe existing identity", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
      profile: {
        type: "guardian",
        id: "guardian-existing-other-campus",
        campusId: OTHER_CAMPUS_ID,
        fullName: "Existing Global Name",
        email: "carol@example.com",
        phoneNumber: "+84900000001",
        dateOfBirth: null,
        gender: Gender.FEMALE,
      },
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([existingUser]);

    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachGuardianResultStatus.ATTACHED_EXISTING_ACCOUNT,
    );
    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(mockTx.createUser).not.toHaveBeenCalled();
    expect(mockTx.createGuardian).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: CAMPUS_ID,
        fullName: "Existing Global Name",
        userId: "user-existing",
      }),
    );
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACH_EXISTING_GUARDIAN_IDENTITY",
        targetType: "guardian",
        campusId: CAMPUS_ID,
      }),
    );
  });

  it("returns same-campus active guardian without mutation audit", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
    });
    const existingGuardian = createGuardian({
      id: "guardian-existing",
      campusId: CAMPUS_ID,
      userId: "user-existing",
      isArchived: false,
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([existingUser]);
    guardianRepo.findAnyByUserIdInCampus.mockResolvedValue(existingGuardian);

    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachGuardianResultStatus.ALREADY_EXISTS_IN_CAMPUS,
    );
    expect(result.guardian.id).toBe("guardian-existing");
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("restores same-campus archived guardian profile", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
    });
    const archivedGuardian = createGuardian({
      id: "guardian-existing",
      campusId: CAMPUS_ID,
      userId: "user-existing",
      isArchived: true,
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([existingUser]);
    guardianRepo.findAnyByUserIdInCampus.mockResolvedValue(archivedGuardian);

    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachGuardianResultStatus.RESTORED_EXISTING_GUARDIAN,
    );
    expect(mockTx.updateGuardian).toHaveBeenCalledWith("guardian-existing", {
      isArchived: false,
      updatedAt: expect.any(Date),
    });
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RESTORE_GUARDIAN",
        targetId: "guardian-existing",
      }),
    );
  });

  it("rejects one-sided internal matches without mutation", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachGuardianErrorCode.IDENTITY_IDENTIFIER_MISMATCH,
      },
    });

    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects split email and phone matches without mutation", async () => {
    userRepo.findManyByEmail.mockResolvedValue([
      createUser({ id: "user-email", clerkUid: "user_email123" }),
    ]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([
      createUser({ id: "user-phone", clerkUid: "user_phone123" }),
    ]);

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachGuardianErrorCode.AMBIGUOUS_IDENTITY_MATCH,
      },
    });

    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects provider-only identity conflicts", async () => {
    identityPort.findIdentitiesByEmail.mockResolvedValue([
      { clerkUid: "user_provider123" },
    ]);
    userRepo.findByClerkUid.mockResolvedValue(null);

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachGuardianErrorCode.IDENTITY_PROVIDER_CONFLICT,
      },
    });

    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects selected-campus identifier collisions for a different guardian", async () => {
    guardianRepo.findByEmailInCampus.mockResolvedValue(
      createGuardian({
        id: "guardian-other",
        campusId: CAMPUS_ID,
        userId: "user-other",
      }),
    );

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachGuardianErrorCode.IDENTITY_IDENTIFIER_MISMATCH,
      },
    });

    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("maps provider lookups to internal users by Clerk UID", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
    });
    identityPort.findIdentitiesByEmail.mockResolvedValue([
      { clerkUid: "user_existing123" },
    ]);
    identityPort.findIdentitiesByPhoneNumber.mockResolvedValue([
      { clerkUid: "user_existing123" },
    ]);
    userRepo.findByClerkUid.mockResolvedValue(existingUser);

    const result = await useCase.execute(
      { ...validInput, campusId: OTHER_CAMPUS_ID },
      actor,
    );

    expect(result.resultStatus).toBe(
      CreateOrAttachGuardianResultStatus.ATTACHED_EXISTING_ACCOUNT,
    );
    expect(mockTx.createGuardian).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: OTHER_CAMPUS_ID,
        userId: "user-existing",
      }),
    );
  });
});
