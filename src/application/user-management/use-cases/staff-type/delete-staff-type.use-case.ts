import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import {
  buildStaffTypeAuditContext,
  pickStaffTypeAuditFields,
} from "./staff-type-audit";

export interface DeleteStaffTypeInput {
  campusId: string;
}

@Injectable()
export class DeleteStaffTypeUseCase {
  private readonly logger = new Logger(DeleteStaffTypeUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  /**
   * Soft delete staff type by archiving it (isArchived = true)
   */
  async execute(
    id: string,
    input: DeleteStaffTypeInput,
    currentUser: User,
  ): Promise<StaffType> {
    try {
      this.logger.log(`Archiving staff type: ${id}`);

      // Find existing staff type
      const staffType = await this.staffTypeRepository.findById(id);
      if (!staffType) {
        throw new NotFoundException(`Staff type with ID "${id}" not found`);
      }
      if (staffType.campusId !== input.campusId) {
        throw new NotFoundException(
          `Staff type with ID "${id}" not found in this campus`,
        );
      }

      // Check if already archived
      if (staffType.isArchived) {
        this.logger.log(`Staff type ${id} is already archived`);
        return staffType;
      }

      const beforeAudit = pickStaffTypeAuditFields(staffType);

      // Archive the staff type (soft delete)
      staffType.archive();
      const afterAudit = pickStaffTypeAuditFields(staffType);

      // Save and audit atomically.
      const archivedStaffType = await this.unitOfWork.run(async (tx) => {
        const archived = await tx.updateStaffType(staffType);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "ARCHIVE_STAFF_TYPE",
          targetType: "staff_type",
          targetId: archived.id,
          campusId: input.campusId,
          context: buildStaffTypeAuditContext(
            archived,
            input.campusId,
            currentUser,
          ),
          beforeValue: beforeAudit,
          afterValue: afterAudit,
        });

        return archived;
      });
      this.logger.log(`Staff type archived: ${archivedStaffType.id}`);

      return archivedStaffType;
    } catch (error) {
      this.logger.error(
        `Failed to archive staff type: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
