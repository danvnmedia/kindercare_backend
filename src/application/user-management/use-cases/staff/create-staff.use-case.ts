import { IdentityPort } from "@/application/ports/identity.port";
import { StaffCodeGeneratorPort } from "@/application/ports/staff-code-generator.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { User } from "@/domain/user-management/user.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { generateSecurePassword } from "@/core/utils/security.utils";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";

export interface CreateStaffInput {
  campusId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  /**
   * Staff types to assign at creation (full-set). Min 1 invariant enforced
   * upstream by the DTO (`@ArrayMinSize(1)`) and downstream by the entity
   * (`Staff.setStaffTypes`). Each entry is validated for existence + active
   * + campus-match before the UoW opens. Two entries sharing the same
   * `defaultRoleId` produce two `user_roles` rows under D-extra-3 of
   * @doc/specs/staff-multi-type-refactor (per-provenance materialization).
   */
  staffTypeIds: string[];
  address?: string;
  dateOfBirth?: Date;
  gender?: Gender;
}

interface ClerkUserResult {
  clerkUid: string;
}

/**
 * Pre-resolved staff-type snapshot built outside the UoW. Carries the bits
 * needed both to hydrate the domain entity's read-side `staffTypes` array
 * and to emit per-type role grants with the correct provenance.
 */
interface ResolvedStaffType {
  defaultRoleId: string | null;
  name: string;
}

@Injectable()
export class CreateStaffUseCase {
  private readonly logger = new Logger(CreateStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
    private readonly staffCodeGenerator: StaffCodeGeneratorPort,
  ) {}

  async execute(input: CreateStaffInput, currentUser: User): Promise<Staff> {
    this.logger.log(
      `Creating staff: ${input.fullName} in campus ${input.campusId}`,
    );

    // Step 1: Validate each staff type (exists, not archived, same campus)
    // and pre-resolve defaultRoleId + name for the inside-UoW phase.
    const resolvedTypes = await this.resolveStaffTypes(
      input.campusId,
      input.staffTypeIds,
    );

    // Step 2: Check Staff uniqueness (email/phone within campus)
    await this.checkStaffUniqueness(input);

    // Step 3: Create Clerk user FIRST (external service - most likely to fail)
    const clerkUser = await this.createClerkUser(input);

    try {
      // Step 4: Generate campus-scoped staff code (ST-YYYY-XXXXXX)
      const staffCode = await this.staffCodeGenerator.generateNextCode(
        input.campusId,
      );

      // Step 5: DB Transaction — User + Staff + join rows + role grants
      // commit atomically (@xo1byz UoW convention for audit-emitting flows).
      const staff = await this.unitOfWork.run(async (tx) => {
        const user = await tx.createUser({
          clerkUid: clerkUser.clerkUid,
          isActive: true,
        });
        this.logger.log(`User created in transaction: ${user.id}`);

        // Hydrate the domain entity with valid {id, name} snapshots so the
        // returned Staff already satisfies the D4 min-1 invariant by the
        // time the response interceptor projects `staffTypes`.
        const staffEntity = Staff.create({
          campusId: input.campusId,
          staffCode,
          fullName: input.fullName,
          email: input.email,
          phoneNumber: input.phoneNumber,
          staffTypes: input.staffTypeIds.map((typeId) => ({
            id: typeId,
            name: resolvedTypes.get(typeId)!.name,
          })),
          address: input.address ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          gender: input.gender ?? null,
          userId: user.id,
        });

        await tx.createStaff({
          id: staffEntity.id,
          campusId: staffEntity.campusId,
          staffCode: staffEntity.staffCode,
          fullName: staffEntity.fullName,
          email: staffEntity.email,
          phoneNumber: staffEntity.phoneNumber,
          address: staffEntity.address,
          dateOfBirth: staffEntity.dateOfBirth,
          gender: staffEntity.gender,
          userId: staffEntity.userId,
          isArchived: staffEntity.isArchived,
          createdAt: staffEntity.createdAt,
          updatedAt: staffEntity.updatedAt,
        });
        await tx.replaceStaffTypes(staffEntity.id, input.staffTypeIds);

        this.logger.log(`Staff created in transaction: ${staffEntity.id}`);

        // Per-type default-role grants. D-extra-3 mandates one
        // `user_roles` row per (type, role) pair — two types sharing the
        // same `defaultRoleId` produce two rows with distinct provenance so
        // a later staff-type swap can revoke each row independently
        // (@doc/specs/tracked-grant-revocation, D5 manual-wins; retired
        // under D2 of @doc/specs/staff-multi-type-refactor — manual rows
        // still ignored by SQL NULL semantics on the IN-list filter).
        const roleAssignments = input.staffTypeIds.flatMap((typeId) => {
          const roleId = resolvedTypes.get(typeId)!.defaultRoleId;
          return roleId
            ? [
                {
                  roleId,
                  campusId: input.campusId,
                  grantedViaStaffTypeId: typeId,
                },
              ]
            : [];
        });
        if (roleAssignments.length > 0) {
          await tx.assignRoles(user.id, roleAssignments);
          this.logger.log(
            `Auto-assigned ${roleAssignments.length} default role grant(s) to user ${user.id} in campus ${input.campusId}`,
          );
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

      this.logger.log(
        `Staff and User account created successfully for: ${input.email}`,
      );
      return staff;
    } catch (error) {
      // Step 6: Compensation — Delete Clerk user if DB transaction fails
      // (@9aa6hm Clerk saga). One Clerk user per staff, so a single
      // compensation call regardless of staff-type cardinality.
      this.logger.error(
        `DB transaction failed, compensating by deleting Clerk user: ${clerkUser.clerkUid}`,
      );
      await this.compensateClerkUser(clerkUser.clerkUid);

      this.logger.error(
        `Failed to create staff: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Failed to create staff: ${error.message}`);
    }
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

  private async checkStaffUniqueness(input: CreateStaffInput): Promise<void> {
    // Check email uniqueness within the same campus
    const existingByEmail = await this.staffRepository.findByEmailInCampus(
      input.campusId,
      input.email,
    );
    if (existingByEmail) {
      throw new ConflictException(
        `Staff with email ${input.email} already exists in this campus`,
      );
    }

    // Check phone uniqueness within the same campus
    const existingByPhone =
      await this.staffRepository.findByPhoneNumberInCampus(
        input.campusId,
        input.phoneNumber,
      );
    if (existingByPhone) {
      throw new ConflictException(
        `Staff with phone number ${input.phoneNumber} already exists in this campus`,
      );
    }
  }

  private async createClerkUser(
    input: CreateStaffInput,
  ): Promise<ClerkUserResult> {
    this.logger.log(`Creating Clerk user for staff: ${input.email}`);

    try {
      const clerkUser = await this.identityPort.provisionUser({
        email: input.email,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        password: generateSecurePassword(),
      });

      this.logger.log(`Clerk user created: ${clerkUser.clerkUid}`);
      return clerkUser;
    } catch (error) {
      this.logger.error(
        `Failed to create Clerk user: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create identity account: ${error.message}`,
      );
    }
  }

  private async compensateClerkUser(clerkUid: string): Promise<void> {
    try {
      await this.identityPort.deleteIdentity(clerkUid);
      this.logger.log(
        `Compensation successful: Clerk user deleted: ${clerkUid}`,
      );
    } catch (compensationError) {
      // Log but don't throw - compensation is best effort
      // This could be handled by a dead letter queue in production
      this.logger.error(
        `Compensation FAILED: Could not delete Clerk user ${clerkUid}. Manual cleanup required.`,
        compensationError.stack,
      );
    }
  }
}
