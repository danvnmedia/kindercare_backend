import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  IdentityLookupResult,
  IdentityPort,
} from "@/application/ports/identity.port";
import { StaffCodeGeneratorPort } from "@/application/ports/staff-code-generator.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";
import { RoleAssignmentInput } from "../../ports/user.repository";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { UserRepository } from "../../ports/user.repository";

const DEFAULT_WEAK_PASSWORD = "ChangeMe123!";

export enum CreateOrAttachStaffResultStatus {
  CREATED_NEW_STAFF = "CREATED_NEW_STAFF",
  ATTACHED_EXISTING_IDENTITY = "ATTACHED_EXISTING_IDENTITY",
  ALREADY_EXISTS_IN_CAMPUS = "ALREADY_EXISTS_IN_CAMPUS",
  RESTORED_EXISTING_STAFF = "RESTORED_EXISTING_STAFF",
}

export const CreateOrAttachStaffErrorCode = {
  IDENTITY_IDENTIFIER_MISMATCH: "IDENTITY_IDENTIFIER_MISMATCH",
  AMBIGUOUS_IDENTITY_MATCH: "AMBIGUOUS_IDENTITY_MATCH",
  IDENTITY_PROVIDER_CONFLICT: "IDENTITY_PROVIDER_CONFLICT",
} as const;

export type CreateOrAttachStaffErrorCode =
  (typeof CreateOrAttachStaffErrorCode)[keyof typeof CreateOrAttachStaffErrorCode];

export interface CreateOrAttachStaffInput {
  campusId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  staffTypeIds: string[];
  address?: string;
  dateOfBirth?: Date;
  gender?: Gender;
}

export interface CreateOrAttachStaffResult {
  resultStatus: CreateOrAttachStaffResultStatus;
  staff: Staff;
}

type IdentityResolution = { kind: "no-match" } | { kind: "match"; user: User };

interface ResolvedStaffType {
  defaultRoleId: string | null;
  name: string;
}

@Injectable()
export class CreateOrAttachStaffUseCase {
  private readonly logger = new Logger(CreateOrAttachStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
    private readonly staffCodeGenerator: StaffCodeGeneratorPort,
  ) {}

  async execute(
    rawInput: CreateOrAttachStaffInput,
    currentUser: User,
  ): Promise<CreateOrAttachStaffResult> {
    const input = this.normalizeInput(rawInput);
    this.logger.log(
      `Creating or attaching staff ${input.email} in campus ${input.campusId}`,
    );

    const resolvedTypes = await this.resolveStaffTypes(
      input.campusId,
      input.staffTypeIds,
    );

    const resolution = await this.resolveIdentity(input);
    if (resolution.kind === "no-match") {
      return this.createNewStaffIdentity(input, currentUser, resolvedTypes);
    }

    return this.attachExistingIdentity(
      input,
      currentUser,
      resolution.user,
      resolvedTypes,
    );
  }

  private async resolveIdentity(
    input: CreateOrAttachStaffInput,
  ): Promise<IdentityResolution> {
    const [
      emailProfileUsers,
      phoneProfileUsers,
      providerEmailMatches,
      providerPhoneMatches,
    ] = await Promise.all([
      this.userRepository.findManyByEmail(input.email),
      this.userRepository.findManyByPhoneNumber(input.phoneNumber),
      this.identityPort.findIdentitiesByEmail(input.email),
      this.identityPort.findIdentitiesByPhoneNumber(input.phoneNumber),
    ]);

    const emailUsers = await this.resolveProviderUsers(
      emailProfileUsers,
      providerEmailMatches,
      "email",
    );
    const phoneUsers = await this.resolveProviderUsers(
      phoneProfileUsers,
      providerPhoneMatches,
      "phone number",
    );

    if (emailUsers.length > 1 || phoneUsers.length > 1) {
      this.throwConflict(
        CreateOrAttachStaffErrorCode.AMBIGUOUS_IDENTITY_MATCH,
        "Submitted identifiers match multiple existing identities",
      );
    }

    const emailUser = emailUsers[0] ?? null;
    const phoneUser = phoneUsers[0] ?? null;

    if (!emailUser && !phoneUser) {
      return { kind: "no-match" };
    }

    if (!emailUser || !phoneUser) {
      this.throwConflict(
        CreateOrAttachStaffErrorCode.IDENTITY_IDENTIFIER_MISMATCH,
        "Submitted email and phone number must both match the same existing identity",
      );
    }

    if (emailUser.id !== phoneUser.id) {
      this.throwConflict(
        CreateOrAttachStaffErrorCode.AMBIGUOUS_IDENTITY_MATCH,
        "Submitted email and phone number match different existing identities",
      );
    }

    return { kind: "match", user: emailUser };
  }

  private async resolveProviderUsers(
    profileUsers: User[],
    providerMatches: IdentityLookupResult[],
    identifierName: string,
  ): Promise<User[]> {
    const usersById = new Map(profileUsers.map((user) => [user.id, user]));
    const providerClerkUids = [
      ...new Set(providerMatches.map((match) => match.clerkUid)),
    ];

    for (const clerkUid of providerClerkUids) {
      const user = await this.userRepository.findByClerkUid(clerkUid);
      if (!user) {
        this.throwConflict(
          CreateOrAttachStaffErrorCode.IDENTITY_PROVIDER_CONFLICT,
          `Identity provider already has this ${identifierName}, but it is not linked to an internal user`,
        );
      }

      usersById.set(user.id, user);
    }

    return [...usersById.values()];
  }

  private async createNewStaffIdentity(
    input: CreateOrAttachStaffInput,
    currentUser: User,
    resolvedTypes: Map<string, ResolvedStaffType>,
  ): Promise<CreateOrAttachStaffResult> {
    await this.assertNoCampusIdentifierCollision(input);

    const clerkUser = await this.provisionIdentity(input);

    try {
      const staffCode = await this.staffCodeGenerator.generateNextCode(
        input.campusId,
      );

      const staff = await this.unitOfWork.run(async (tx) => {
        const user = await tx.createUser({
          clerkUid: clerkUser.clerkUid,
          isActive: true,
        });

        const staffEntity = this.buildStaff(
          input,
          user.id,
          staffCode,
          resolvedTypes,
        );
        await tx.createStaff(this.toStaffTxData(staffEntity));
        await tx.replaceStaffTypes(staffEntity.id, input.staffTypeIds);

        const roleAssignments = this.buildRoleAssignments(
          input.campusId,
          input.staffTypeIds,
          resolvedTypes,
        );
        if (roleAssignments.length > 0) {
          await tx.assignRoles(user.id, roleAssignments);
        }

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "CREATE_STAFF",
          targetType: "staff",
          targetId: staffEntity.id,
          campusId: staffEntity.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            name: staffEntity.fullName,
            code: staffEntity.staffCode,
          },
        });

        return staffEntity;
      });

      return {
        resultStatus: CreateOrAttachStaffResultStatus.CREATED_NEW_STAFF,
        staff,
      };
    } catch (error) {
      await this.compensateIdentity(clerkUser.clerkUid);
      throw error;
    }
  }

  private async attachExistingIdentity(
    input: CreateOrAttachStaffInput,
    currentUser: User,
    user: User,
    resolvedTypes: Map<string, ResolvedStaffType>,
  ): Promise<CreateOrAttachStaffResult> {
    const existingStaff = await this.staffRepository.findAnyByUserIdInCampus(
      user.id,
      input.campusId,
    );

    if (existingStaff && !existingStaff.isArchived) {
      return {
        resultStatus: CreateOrAttachStaffResultStatus.ALREADY_EXISTS_IN_CAMPUS,
        staff: existingStaff,
      };
    }

    if (existingStaff?.isArchived) {
      const derivedRoleAssignments =
        await this.buildActiveStaffTypeRoleAssignments(existingStaff);
      existingStaff.restore();

      await this.unitOfWork.run(async (tx) => {
        await tx.updateStaff(existingStaff.id, {
          isArchived: false,
          updatedAt: existingStaff.updatedAt,
        });

        if (
          existingStaff.hasUserAccount() &&
          derivedRoleAssignments.length > 0
        ) {
          await tx.assignRoles(existingStaff.userId!, derivedRoleAssignments);
        }

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "RESTORE_STAFF",
          targetType: "staff",
          targetId: existingStaff.id,
          campusId: existingStaff.campusId,
          context: { actorName: currentUser.profile?.fullName ?? null },
          beforeValue: { isArchived: true },
          afterValue: { isArchived: false },
        });
      });

      return {
        resultStatus: CreateOrAttachStaffResultStatus.RESTORED_EXISTING_STAFF,
        staff: existingStaff,
      };
    }

    await this.assertNoCampusIdentifierCollision(input, user.id);
    const staffCode = await this.staffCodeGenerator.generateNextCode(
      input.campusId,
    );

    const staff = await this.unitOfWork.run(async (tx) => {
      const staffEntity = this.buildStaff(
        input,
        user.id,
        staffCode,
        resolvedTypes,
        this.resolveGlobalFullName(user, input),
      );
      await tx.createStaff(this.toStaffTxData(staffEntity));
      await tx.replaceStaffTypes(staffEntity.id, input.staffTypeIds);

      const roleAssignments = this.buildRoleAssignments(
        input.campusId,
        input.staffTypeIds,
        resolvedTypes,
      );
      if (roleAssignments.length > 0) {
        await tx.assignRoles(user.id, roleAssignments);
      }

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "ATTACH_EXISTING_STAFF_IDENTITY",
        targetType: "staff",
        targetId: staffEntity.id,
        campusId: staffEntity.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          name: staffEntity.fullName,
          code: staffEntity.staffCode,
        },
      });

      return staffEntity;
    });

    return {
      resultStatus: CreateOrAttachStaffResultStatus.ATTACHED_EXISTING_IDENTITY,
      staff,
    };
  }

  private async resolveStaffTypes(
    campusId: string,
    staffTypeIds: string[],
  ): Promise<Map<string, ResolvedStaffType>> {
    const resolved = new Map<string, ResolvedStaffType>();
    for (const typeId of staffTypeIds) {
      const staffType = await this.staffTypeRepository.findById(typeId);
      if (!staffType) {
        throw new NotFoundException(`Staff type with ID ${typeId} not found`);
      }
      if (staffType.isArchived) {
        throw new BadRequestException(
          `Staff type ${staffType.name} is archived`,
        );
      }
      if (staffType.campusId !== campusId) {
        throw new BadRequestException(
          `Staff type ${staffType.name} does not belong to the specified campus`,
        );
      }
      resolved.set(typeId, {
        defaultRoleId: staffType.defaultRoleId,
        name: staffType.name,
      });
    }
    return resolved;
  }

  private async buildActiveStaffTypeRoleAssignments(
    staff: Staff,
  ): Promise<Array<RoleAssignmentInput & { grantedViaStaffTypeId: string }>> {
    if (!staff.hasUserAccount()) {
      return [];
    }

    const assignments: Array<
      RoleAssignmentInput & { grantedViaStaffTypeId: string }
    > = [];

    for (const staffTypeSnapshot of staff.staffTypes) {
      const staffType = await this.staffTypeRepository.findById(
        staffTypeSnapshot.id,
      );

      if (
        !staffType ||
        staffType.isArchived ||
        staffType.campusId !== staff.campusId ||
        !staffType.defaultRoleId
      ) {
        continue;
      }

      assignments.push({
        roleId: staffType.defaultRoleId,
        campusId: staff.campusId,
        grantedViaStaffTypeId: staffType.id,
      });
    }

    return assignments;
  }

  private buildRoleAssignments(
    campusId: string,
    staffTypeIds: string[],
    resolvedTypes: Map<string, ResolvedStaffType>,
  ): Array<RoleAssignmentInput & { grantedViaStaffTypeId: string }> {
    return staffTypeIds.flatMap((typeId) => {
      const roleId = resolvedTypes.get(typeId)!.defaultRoleId;
      return roleId
        ? [
            {
              roleId,
              campusId,
              grantedViaStaffTypeId: typeId,
            },
          ]
        : [];
    });
  }

  private async assertNoCampusIdentifierCollision(
    input: CreateOrAttachStaffInput,
    matchedUserId?: string,
  ): Promise<void> {
    const [existingByEmail, existingByPhone] = await Promise.all([
      this.staffRepository.findByEmailInCampus(input.campusId, input.email),
      this.staffRepository.findByPhoneNumberInCampus(
        input.campusId,
        input.phoneNumber,
      ),
    ]);

    for (const existing of [existingByEmail, existingByPhone]) {
      if (!existing) {
        continue;
      }

      if (!matchedUserId || existing.userId !== matchedUserId) {
        this.throwConflict(
          CreateOrAttachStaffErrorCode.IDENTITY_IDENTIFIER_MISMATCH,
          "Submitted identifiers conflict with an existing staff profile in this campus",
        );
      }
    }
  }

  private buildStaff(
    input: CreateOrAttachStaffInput,
    userId: string,
    staffCode: string,
    resolvedTypes: Map<string, ResolvedStaffType>,
    fullName = input.fullName,
  ): Staff {
    return Staff.create({
      campusId: input.campusId,
      staffCode,
      fullName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      staffTypes: input.staffTypeIds.map((typeId) => ({
        id: typeId,
        name: resolvedTypes.get(typeId)!.name,
      })),
      address: input.address ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      userId,
    });
  }

  private resolveGlobalFullName(
    user: User,
    input: CreateOrAttachStaffInput,
  ): string {
    return user.profile?.fullName?.trim() || input.fullName;
  }

  private toStaffTxData(staff: Staff) {
    return {
      id: staff.id,
      campusId: staff.campusId,
      staffCode: staff.staffCode,
      fullName: staff.fullName,
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      address: staff.address,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      userId: staff.userId,
      isArchived: staff.isArchived,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  private async provisionIdentity(input: CreateOrAttachStaffInput) {
    try {
      return await this.identityPort.provisionUser({
        email: input.email,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        password: DEFAULT_WEAK_PASSWORD,
      });
    } catch (error) {
      this.logger.error(
        `Failed to provision staff identity: ${this.errorMessage(error)}`,
      );
      this.throwConflict(
        CreateOrAttachStaffErrorCode.IDENTITY_PROVIDER_CONFLICT,
        "Identity provider rejected this email or phone number",
      );
    }
  }

  private async compensateIdentity(clerkUid: string): Promise<void> {
    try {
      await this.identityPort.deleteIdentity(clerkUid);
    } catch (error) {
      this.logger.error(
        `Compensation failed for Clerk user ${clerkUid}: ${this.errorMessage(error)}`,
      );
    }
  }

  private normalizeInput(
    input: CreateOrAttachStaffInput,
  ): CreateOrAttachStaffInput {
    return {
      ...input,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phoneNumber: input.phoneNumber.trim(),
    };
  }

  private throwConflict(
    code: CreateOrAttachStaffErrorCode,
    message: string,
  ): never {
    throw new ConflictException({ code, message });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
