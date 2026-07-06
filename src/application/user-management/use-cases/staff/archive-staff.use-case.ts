import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { User } from "@/domain/user-management/user.entity";
import { StaffRepository } from "../../ports/staff.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";

/**
 * Archive Staff Use Case (Soft Delete)
 *
 * Performs profile-scoped soft delete by archiving the Staff row and revoking
 * StaffType-derived role grants. Manual grants are preserved by provenance.
 */
@Injectable()
export class ArchiveStaffUseCase {
  private readonly logger = new Logger(ArchiveStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    campusId: string,
    currentUser: User,
  ): Promise<Staff> {
    this.logger.log(`Archiving staff: ${id} in campus ${campusId}`);

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

    // Step 3: Archive staff + revoke derived grants + emit audit row atomically.
    staff.archive();

    await this.unitOfWork.run(async (tx) => {
      await tx.updateStaff(staff.id, {
        isArchived: true,
        updatedAt: staff.updatedAt,
      });
      this.logger.log(`Staff archived in transaction: ${id}`);

      if (staff.hasUserAccount()) {
        const staffTypeIds = staff.staffTypes.map((staffType) => staffType.id);
        if (staffTypeIds.length > 0) {
          await tx.revokeRolesByProvenance(staff.userId!, staffTypeIds);
          this.logger.log(
            `Revoked StaffType-derived grants for user ${staff.userId} from staffTypes [${staffTypeIds.join(", ")}]`,
          );
        }
      }

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "ARCHIVE_STAFF",
        targetType: "staff",
        targetId: staff.id,
        campusId: staff.campusId,
        context: { actorName: currentUser.profile?.fullName ?? null },
        beforeValue: { isArchived: false },
        afterValue: { isArchived: true },
      });
    });

    this.logger.log(`Staff archived successfully: ${id}`);
    return staff;
  }
}
