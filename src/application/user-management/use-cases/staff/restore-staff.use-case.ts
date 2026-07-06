import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { User } from "@/domain/user-management/user.entity";
import { StaffRepository } from "../../ports/staff.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { RoleAssignmentInput } from "../../ports/user.repository";

/**
 * Restore Staff Use Case
 *
 * Restores only the campus Staff profile and recreates StaffType-derived role
 * grants. Global identity unlock/reactivation is handled by identity-admin flows.
 */
@Injectable()
export class RestoreStaffUseCase {
  private readonly logger = new Logger(RestoreStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    campusId: string,
    currentUser: User,
  ): Promise<Staff> {
    this.logger.log(`Restoring staff: ${id} in campus ${campusId}`);

    // Step 1: Find existing staff
    const staff = await this.staffRepository.findById(id);
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    // Step 2: Verify staff belongs to the specified campus
    if (staff.campusId !== campusId) {
      throw new NotFoundException(
        `Staff with ID ${id} not found in this campus`,
      );
    }

    // Step 3: Verify staff is archived
    if (!staff.isArchived) {
      throw new BadRequestException(`Staff with ID ${id} is not archived`);
    }

    // Step 4: Resolve active StaffType default-role grants before opening UoW.
    const derivedRoleAssignments =
      await this.buildActiveStaffTypeRoleAssignments(staff);

    // Step 5: Restore staff + recreate derived grants + emit audit row atomically.
    staff.restore();

    await this.unitOfWork.run(async (tx) => {
      await tx.updateStaff(staff.id, {
        isArchived: false,
        updatedAt: staff.updatedAt,
      });
      this.logger.log(`Staff restored in transaction: ${id}`);

      if (staff.hasUserAccount() && derivedRoleAssignments.length > 0) {
        await tx.assignRoles(staff.userId!, derivedRoleAssignments);
        this.logger.log(
          `Recreated ${derivedRoleAssignments.length} StaffType-derived grant(s) for user ${staff.userId} in campus ${staff.campusId}`,
        );
      }

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "RESTORE_STAFF",
        targetType: "staff",
        targetId: staff.id,
        campusId: staff.campusId,
        context: { actorName: currentUser.profile?.fullName ?? null },
        beforeValue: { isArchived: true },
        afterValue: { isArchived: false },
      });
    });

    this.logger.log(`Staff restored successfully: ${id}`);
    return staff;
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
}
