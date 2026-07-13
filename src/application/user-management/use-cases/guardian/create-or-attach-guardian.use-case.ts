import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  IdentityLookupResult,
  IdentityPort,
} from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";

const DEFAULT_WEAK_PASSWORD = "ChangeMe123!";

export enum CreateOrAttachGuardianResultStatus {
  CREATED_NEW_ACCOUNT = "CREATED_NEW_ACCOUNT",
  ATTACHED_EXISTING_ACCOUNT = "ATTACHED_EXISTING_ACCOUNT",
  ALREADY_EXISTS_IN_CAMPUS = "ALREADY_EXISTS_IN_CAMPUS",
  RESTORED_EXISTING_GUARDIAN = "RESTORED_EXISTING_GUARDIAN",
}

export const CreateOrAttachGuardianErrorCode = {
  IDENTITY_IDENTIFIER_MISMATCH: "IDENTITY_IDENTIFIER_MISMATCH",
  AMBIGUOUS_IDENTITY_MATCH: "AMBIGUOUS_IDENTITY_MATCH",
  IDENTITY_PROVIDER_CONFLICT: "IDENTITY_PROVIDER_CONFLICT",
} as const;

export type CreateOrAttachGuardianErrorCode =
  (typeof CreateOrAttachGuardianErrorCode)[keyof typeof CreateOrAttachGuardianErrorCode];

export interface CreateOrAttachGuardianInput {
  campusId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  gender: Gender;
  dateOfBirth?: Date;
  address?: string;
  occupation?: string;
  workAddress?: string;
}

export interface CreateOrAttachGuardianResult {
  resultStatus: CreateOrAttachGuardianResultStatus;
  guardian: Guardian;
}

type IdentityResolution = { kind: "no-match" } | { kind: "match"; user: User };

@Injectable()
export class CreateOrAttachGuardianUseCase {
  private readonly logger = new Logger(CreateOrAttachGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(
    rawInput: CreateOrAttachGuardianInput,
    currentUser: User,
  ): Promise<CreateOrAttachGuardianResult> {
    const input = this.normalizeInput(rawInput);
    this.logger.log(
      `Creating or attaching guardian ${input.email} in campus ${input.campusId}`,
    );

    this.validateAge(input.dateOfBirth);

    const resolution = await this.resolveIdentity(input);
    if (resolution.kind === "no-match") {
      return this.createNewAccount(input, currentUser);
    }

    return this.attachExistingAccount(input, currentUser, resolution.user);
  }

  private async resolveIdentity(
    input: CreateOrAttachGuardianInput,
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
        CreateOrAttachGuardianErrorCode.AMBIGUOUS_IDENTITY_MATCH,
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
        CreateOrAttachGuardianErrorCode.IDENTITY_IDENTIFIER_MISMATCH,
        "Submitted email and phone number must both match the same existing identity",
      );
    }

    if (emailUser.id !== phoneUser.id) {
      this.throwConflict(
        CreateOrAttachGuardianErrorCode.AMBIGUOUS_IDENTITY_MATCH,
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
          CreateOrAttachGuardianErrorCode.IDENTITY_PROVIDER_CONFLICT,
          `Identity provider already has this ${identifierName}, but it is not linked to an internal user`,
        );
      }

      usersById.set(user.id, user);
    }

    return [...usersById.values()];
  }

  private async createNewAccount(
    input: CreateOrAttachGuardianInput,
    currentUser: User,
  ): Promise<CreateOrAttachGuardianResult> {
    await this.assertNoCampusIdentifierCollision(input);

    const clerkUser = await this.provisionIdentity(input);

    try {
      const guardian = await this.unitOfWork.run(async (tx) => {
        const user = await tx.createUser({
          clerkUid: clerkUser.clerkUid,
          isActive: true,
        });

        const guardianEntity = this.buildGuardian(input, user.id);
        await tx.createGuardian(this.toGuardianTxData(guardianEntity));

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "CREATE_GUARDIAN",
          targetType: "guardian",
          targetId: guardianEntity.id,
          campusId: guardianEntity.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            name: guardianEntity.fullName,
            email: guardianEntity.email,
            phoneNumber: guardianEntity.phoneNumber,
          },
        });

        return guardianEntity;
      });

      return {
        resultStatus: CreateOrAttachGuardianResultStatus.CREATED_NEW_ACCOUNT,
        guardian,
      };
    } catch (error) {
      await this.compensateIdentity(clerkUser.clerkUid);
      throw error;
    }
  }

  private async attachExistingAccount(
    input: CreateOrAttachGuardianInput,
    currentUser: User,
    user: User,
  ): Promise<CreateOrAttachGuardianResult> {
    const existingGuardian =
      await this.guardianRepository.findAnyByUserIdInCampus(
        user.id,
        input.campusId,
      );

    if (existingGuardian && !existingGuardian.isArchived) {
      return {
        resultStatus:
          CreateOrAttachGuardianResultStatus.ALREADY_EXISTS_IN_CAMPUS,
        guardian: existingGuardian,
      };
    }

    if (existingGuardian?.isArchived) {
      existingGuardian.restore();

      await this.unitOfWork.run(async (tx) => {
        await tx.updateGuardian(existingGuardian.id, {
          isArchived: false,
          updatedAt: existingGuardian.updatedAt,
        });

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "RESTORE_GUARDIAN",
          targetType: "guardian",
          targetId: existingGuardian.id,
          campusId: existingGuardian.campusId,
          context: { actorName: currentUser.profile?.fullName ?? null },
          beforeValue: { isArchived: true },
          afterValue: { isArchived: false },
        });
      });

      return {
        resultStatus:
          CreateOrAttachGuardianResultStatus.RESTORED_EXISTING_GUARDIAN,
        guardian: existingGuardian,
      };
    }

    await this.assertNoCampusIdentifierCollision(input, user.id);

    const guardian = await this.unitOfWork.run(async (tx) => {
      const guardianEntity = this.buildGuardian(
        input,
        user.id,
        this.resolveGlobalFullName(user, input),
      );
      await tx.createGuardian(this.toGuardianTxData(guardianEntity));

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "ATTACH_EXISTING_GUARDIAN_IDENTITY",
        targetType: "guardian",
        targetId: guardianEntity.id,
        campusId: guardianEntity.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          name: guardianEntity.fullName,
          email: guardianEntity.email,
          phoneNumber: guardianEntity.phoneNumber,
        },
      });

      return guardianEntity;
    });

    return {
      resultStatus:
        CreateOrAttachGuardianResultStatus.ATTACHED_EXISTING_ACCOUNT,
      guardian,
    };
  }

  private async assertNoCampusIdentifierCollision(
    input: CreateOrAttachGuardianInput,
    matchedUserId?: string,
  ): Promise<void> {
    const [existingByEmail, existingByPhone] = await Promise.all([
      this.guardianRepository.findByEmailInCampus(input.campusId, input.email),
      this.guardianRepository.findByPhoneNumberInCampus(
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
          CreateOrAttachGuardianErrorCode.IDENTITY_IDENTIFIER_MISMATCH,
          "Submitted identifiers conflict with an existing guardian in this campus",
        );
      }
    }
  }

  private buildGuardian(
    input: CreateOrAttachGuardianInput,
    userId: string,
    fullName = input.fullName,
  ): Guardian {
    return Guardian.create({
      campusId: input.campusId,
      fullName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      address: input.address ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender,
      occupation: input.occupation ?? null,
      workAddress: input.workAddress ?? null,
      userId,
    });
  }

  private resolveGlobalFullName(
    user: User,
    input: CreateOrAttachGuardianInput,
  ): string {
    return user.profile?.fullName?.trim() || input.fullName;
  }

  private toGuardianTxData(guardian: Guardian) {
    return {
      id: guardian.id,
      campusId: guardian.campusId,
      fullName: guardian.fullName,
      email: guardian.email,
      phoneNumber: guardian.phoneNumber,
      address: guardian.address,
      dateOfBirth: guardian.dateOfBirth,
      gender: guardian.gender,
      occupation: guardian.occupation,
      workAddress: guardian.workAddress,
      userId: guardian.userId,
      isArchived: guardian.isArchived,
      createdAt: guardian.createdAt,
      updatedAt: guardian.updatedAt,
    };
  }

  private async provisionIdentity(input: CreateOrAttachGuardianInput) {
    try {
      return await this.identityPort.provisionUser({
        email: input.email,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        password: DEFAULT_WEAK_PASSWORD,
      });
    } catch (error) {
      this.logger.error(
        `Failed to provision guardian identity: ${this.errorMessage(error)}`,
      );
      this.throwConflict(
        CreateOrAttachGuardianErrorCode.IDENTITY_PROVIDER_CONFLICT,
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

  private validateAge(dateOfBirth?: Date): void {
    if (!dateOfBirth) {
      return;
    }

    if (this.calculateAge(dateOfBirth) < 18) {
      throw new BadRequestException("Guardian must be at least 18 years old");
    }
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  private normalizeInput(
    input: CreateOrAttachGuardianInput,
  ): CreateOrAttachGuardianInput {
    return {
      ...input,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phoneNumber: input.phoneNumber.trim(),
    };
  }

  private throwConflict(
    code: CreateOrAttachGuardianErrorCode,
    message: string,
  ): never {
    throw new ConflictException({ code, message });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
