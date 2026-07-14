import { BadRequestException, NotFoundException } from "@nestjs/common";

import { IdentityPort } from "@/application/ports/identity.port";
import { StaffCodeGeneratorPort } from "@/application/ports/staff-code-generator.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { Role } from "@/domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";
import {
  createMockRoleRepository,
  createMockStaffRepository,
  createMockUserRepository,
  createStaff,
  createUser,
} from "@/test-utils";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { RoleRepository } from "../../ports/role.repository";
import { UserRepository } from "../../ports/user.repository";
import {
  CreateOrAttachStaffErrorCode,
  CreateOrAttachStaffResultStatus,
  CreateOrAttachStaffUseCase,
} from "./create-or-attach-staff.use-case";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const STAFF_CODE = "ST-2026-000043";
const TYPE_TEACHER = "stype-teacher";
const TYPE_EXISTING = "stype-existing";
const ROLE_STAFF = "role-staff";
const ROLE_EXISTING = "role-existing";
const ROLE_CAMPUS_ACCESS = "role-campus-access";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_audit12345",
      isActive: true,
      profile: {
        type: "staff",
        id: ACTOR_ID,
        campusId: CAMPUS_ID,
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

function buildRole(overrides: Partial<Role> = {}): Role {
  return {
    id: ROLE_CAMPUS_ACCESS,
    name: "Staff Campus Access",
    description: null,
    campusId: CAMPUS_ID,
    isSystemDefault: true,
    isSystemRole: false,
    permissions: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("CreateOrAttachStaffUseCase", () => {
  let useCase: CreateOrAttachStaffUseCase;
  let staffRepo: jest.Mocked<StaffRepository>;
  let staffTypeRepo: jest.Mocked<StaffTypeRepository>;
  let roleRepo: jest.Mocked<RoleRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let identityPort: jest.Mocked<IdentityPort>;
  let staffCodeGenerator: jest.Mocked<StaffCodeGeneratorPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  const validInput = {
    campusId: CAMPUS_ID,
    fullName: "Dan Le",
    email: "DAN@example.com",
    phoneNumber: "+84900000002",
    staffTypeIds: [TYPE_TEACHER],
    gender: Gender.MALE,
  };

  beforeEach(() => {
    staffRepo = createMockStaffRepository();
    staffTypeRepo = {
      findById: jest
        .fn()
        .mockImplementation(async (id: string) =>
          stype({ id, defaultRoleId: ROLE_STAFF }),
        ),
    } as unknown as jest.Mocked<StaffTypeRepository>;
    roleRepo = createMockRoleRepository();
    roleRepo.ensureCampusAccessRole.mockResolvedValue(buildRole());
    userRepo = createMockUserRepository();
    mockTx = {
      createUser: jest
        .fn()
        .mockResolvedValue({ id: "user-new", clerkUid: "user_new123" }),
      createStaff: jest.fn().mockResolvedValue({ id: "staff-new" }),
      updateStaff: jest.fn().mockResolvedValue({ id: "staff-existing" }),
      replaceStaffTypes: jest.fn().mockResolvedValue(undefined),
      assignRoles: jest.fn().mockResolvedValue(1),
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
    staffCodeGenerator = {
      generateNextCode: jest.fn().mockResolvedValue(STAFF_CODE),
    } as unknown as jest.Mocked<StaffCodeGeneratorPort>;
    actor = buildActor();

    staffRepo.findByEmailInCampus.mockResolvedValue(null);
    staffRepo.findByPhoneNumberInCampus.mockResolvedValue(null);
    staffRepo.findAnyByUserIdInCampus.mockResolvedValue(null);
    userRepo.findManyByEmail.mockResolvedValue([]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([]);
    userRepo.findByClerkUid.mockResolvedValue(null);

    useCase = new CreateOrAttachStaffUseCase(
      staffRepo,
      staffTypeRepo,
      userRepo,
      roleRepo,
      unitOfWork,
      identityPort,
      staffCodeGenerator,
    );
  });

  it("creates a new identity and target-campus staff profile when no identifiers match", async () => {
    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachStaffResultStatus.CREATED_NEW_STAFF,
    );
    expect(identityPort.provisionUser).toHaveBeenCalledWith({
      email: "dan@example.com",
      fullName: "Dan Le",
      phoneNumber: "+84900000002",
      password: "ChangeMe123!",
    });
    expect(mockTx.createUser).toHaveBeenCalledWith({
      clerkUid: "user_new123",
      isActive: true,
    });
    expect(mockTx.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: CAMPUS_ID,
        staffCode: STAFF_CODE,
        email: "dan@example.com",
        userId: "user-new",
      }),
    );
    expect(mockTx.replaceStaffTypes).toHaveBeenCalledWith(result.staff.id, [
      TYPE_TEACHER,
    ]);
    expect(mockTx.assignRoles).toHaveBeenCalledWith("user-new", [
      {
        roleId: ROLE_STAFF,
        campusId: CAMPUS_ID,
        grantedViaStaffTypeId: TYPE_TEACHER,
      },
    ]);
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_STAFF",
        targetType: "staff",
        campusId: CAMPUS_ID,
      }),
    );
  });

  it("creates a new staff profile with the backend-managed campus access role when selected StaffTypes have no default role", async () => {
    staffTypeRepo.findById.mockImplementation(
      async (id: string) => stype({ id, defaultRoleId: null }) as never,
    );

    await useCase.execute(validInput, actor);

    expect(roleRepo.ensureCampusAccessRole).toHaveBeenCalledWith(CAMPUS_ID);
    expect(mockTx.assignRoles).toHaveBeenCalledWith("user-new", [
      {
        roleId: ROLE_CAMPUS_ACCESS,
        campusId: CAMPUS_ID,
        grantedViaStaffTypeId: TYPE_TEACHER,
      },
    ]);
  });

  it("attaches an existing staff identity to a new campus without Clerk creation", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
      profile: {
        type: "staff",
        id: "staff-other-campus",
        campusId: OTHER_CAMPUS_ID,
        fullName: "Existing Global Name",
        email: "dan@example.com",
        phoneNumber: "+84900000002",
        dateOfBirth: null,
        gender: Gender.MALE,
      },
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([existingUser]);

    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachStaffResultStatus.ATTACHED_EXISTING_IDENTITY,
    );
    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(mockTx.createUser).not.toHaveBeenCalled();
    expect(mockTx.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: CAMPUS_ID,
        fullName: "Existing Global Name",
        userId: "user-existing",
      }),
    );
    expect(mockTx.assignRoles).toHaveBeenCalledWith("user-existing", [
      {
        roleId: ROLE_STAFF,
        campusId: CAMPUS_ID,
        grantedViaStaffTypeId: TYPE_TEACHER,
      },
    ]);
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ATTACH_EXISTING_STAFF_IDENTITY",
        targetType: "staff",
        campusId: CAMPUS_ID,
      }),
    );
  });

  it("can attach a guardian-only internal identity as target-campus staff", async () => {
    const existingUser = createUser({
      id: "user-guardian-only",
      clerkUid: "user_guardian123",
      profile: {
        type: "guardian",
        id: "guardian-existing",
        campusId: OTHER_CAMPUS_ID,
        fullName: "Parent Identity Name",
        email: "dan@example.com",
        phoneNumber: "+84900000002",
        dateOfBirth: null,
        gender: Gender.MALE,
      },
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([existingUser]);

    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachStaffResultStatus.ATTACHED_EXISTING_IDENTITY,
    );
    expect(mockTx.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Parent Identity Name",
        userId: "user-guardian-only",
      }),
    );
  });

  it("returns same-campus active staff without mutation audit or duplicate grants", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
    });
    const existingStaff = createStaff({
      id: "staff-existing",
      campusId: CAMPUS_ID,
      userId: "user-existing",
      isArchived: false,
      staffTypes: [{ id: TYPE_EXISTING, name: "Teacher" }],
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([existingUser]);
    staffRepo.findAnyByUserIdInCampus.mockResolvedValue(existingStaff);

    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachStaffResultStatus.ALREADY_EXISTS_IN_CAMPUS,
    );
    expect(result.staff.id).toBe("staff-existing");
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(staffCodeGenerator.generateNextCode).not.toHaveBeenCalled();
    expect(identityPort.provisionUser).not.toHaveBeenCalled();
  });

  it("restores same-campus archived staff and reapplies that profile's current StaffType grants", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
    });
    const archivedStaff = createStaff({
      id: "staff-existing",
      campusId: CAMPUS_ID,
      userId: "user-existing",
      isArchived: true,
      staffTypes: [{ id: TYPE_EXISTING, name: "Existing Type" }],
    });
    staffTypeRepo.findById.mockImplementation(async (id: string) => {
      if (id === TYPE_EXISTING) {
        return stype({
          id,
          name: "Existing Type",
          defaultRoleId: ROLE_EXISTING,
        }) as never;
      }
      return stype({ id, defaultRoleId: ROLE_STAFF }) as never;
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([existingUser]);
    staffRepo.findAnyByUserIdInCampus.mockResolvedValue(archivedStaff);

    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachStaffResultStatus.RESTORED_EXISTING_STAFF,
    );
    expect(mockTx.updateStaff).toHaveBeenCalledWith("staff-existing", {
      isArchived: false,
      updatedAt: expect.any(Date),
    });
    expect(mockTx.replaceStaffTypes).not.toHaveBeenCalled();
    expect(mockTx.assignRoles).toHaveBeenCalledWith("user-existing", [
      {
        roleId: ROLE_EXISTING,
        campusId: CAMPUS_ID,
        grantedViaStaffTypeId: TYPE_EXISTING,
      },
    ]);
    expect(mockTx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "RESTORE_STAFF",
        targetId: "staff-existing",
      }),
    );
  });

  it("rejects invalid requested StaffTypes before identity lookup or mutation", async () => {
    staffTypeRepo.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute(validInput, actor)).rejects.toThrow(
      NotFoundException,
    );

    expect(userRepo.findManyByEmail).not.toHaveBeenCalled();
    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects archived requested StaffTypes before mutation", async () => {
    staffTypeRepo.findById.mockResolvedValueOnce(
      stype({ id: TYPE_TEACHER, isArchived: true }) as never,
    );

    await expect(useCase.execute(validInput, actor)).rejects.toThrow(
      BadRequestException,
    );

    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects one-sided internal matches without side effects", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachStaffErrorCode.IDENTITY_IDENTIFIER_MISMATCH,
      },
    });

    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects split email and phone matches without side effects", async () => {
    userRepo.findManyByEmail.mockResolvedValue([
      createUser({ id: "user-email", clerkUid: "user_email123" }),
    ]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([
      createUser({ id: "user-phone", clerkUid: "user_phone123" }),
    ]);

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachStaffErrorCode.AMBIGUOUS_IDENTITY_MATCH,
      },
    });

    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects ambiguous internal matches without side effects", async () => {
    userRepo.findManyByEmail.mockResolvedValue([
      createUser({ id: "user-1", clerkUid: "user_one123" }),
      createUser({ id: "user-2", clerkUid: "user_two123" }),
    ]);

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachStaffErrorCode.AMBIGUOUS_IDENTITY_MATCH,
      },
    });

    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("rejects provider-only identity conflicts without creating local rows", async () => {
    identityPort.findIdentitiesByEmail.mockResolvedValue([
      { clerkUid: "user_provider123" },
    ]);
    userRepo.findByClerkUid.mockResolvedValue(null);

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachStaffErrorCode.IDENTITY_PROVIDER_CONFLICT,
      },
    });

    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(mockTx.createStaff).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("maps provider matches to an internal user by Clerk UID", async () => {
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

    const result = await useCase.execute(validInput, actor);

    expect(result.resultStatus).toBe(
      CreateOrAttachStaffResultStatus.ATTACHED_EXISTING_IDENTITY,
    );
    expect(mockTx.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: CAMPUS_ID,
        userId: "user-existing",
      }),
    );
  });

  it("rejects selected-campus staff identifier collisions for a different identity", async () => {
    staffRepo.findByEmailInCampus.mockResolvedValue(
      createStaff({
        id: "staff-other",
        campusId: CAMPUS_ID,
        userId: "user-other",
      }),
    );

    await expect(useCase.execute(validInput, actor)).rejects.toMatchObject({
      response: {
        code: CreateOrAttachStaffErrorCode.IDENTITY_IDENTIFIER_MISMATCH,
      },
    });

    expect(identityPort.provisionUser).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("compensates the provisioned identity when the new-staff transaction fails", async () => {
    mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

    await expect(useCase.execute(validInput, actor)).rejects.toThrow(
      "audit fail",
    );

    expect(mockTx.createStaff).toHaveBeenCalledTimes(1);
    expect(identityPort.deleteIdentity).toHaveBeenCalledWith("user_new123");
  });

  it("does not expose source identity profiles in the selected-campus result", async () => {
    const existingUser = createUser({
      id: "user-existing",
      clerkUid: "user_existing123",
      profiles: [
        {
          type: "guardian",
          id: "guardian-other-campus",
          campusId: OTHER_CAMPUS_ID,
          fullName: "Parent Identity Name",
          email: "dan@example.com",
          phoneNumber: "+84900000002",
          dateOfBirth: null,
          gender: Gender.MALE,
        },
      ],
    });
    userRepo.findManyByEmail.mockResolvedValue([existingUser]);
    userRepo.findManyByPhoneNumber.mockResolvedValue([existingUser]);

    const result = await useCase.execute(validInput, actor);

    expect(result.staff.campusId).toBe(CAMPUS_ID);
    expect(result.staff).not.toHaveProperty("profiles");
    expect(result.staff).not.toHaveProperty("guardians");
    expect(result.staff).not.toHaveProperty("roles");
  });
});
