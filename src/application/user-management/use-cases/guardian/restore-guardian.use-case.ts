import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { User } from "@/domain/user-management/user.entity";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";

/**
 * Restore Guardian Use Case
 *
 * Restores only the campus Guardian profile. Global identity unlock/reactivation
 * is handled by explicit identity-admin flows.
 */
@Injectable()
export class RestoreGuardianUseCase {
  private readonly logger = new Logger(RestoreGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    campusId: string | undefined,
    currentUser: User,
  ): Promise<Guardian> {
    this.logger.log(`Restoring guardian: ${id}`);

    // Step 1: Find existing guardian
    const guardian = await this.guardianRepository.findById(id);
    if (!guardian) {
      throw new NotFoundException(`Guardian with ID ${id} not found`);
    }

    // Step 2: Verify guardian belongs to the specified campus (if campusId provided)
    if (campusId && guardian.campusId !== campusId) {
      throw new NotFoundException(
        `Guardian with ID ${id} not found in this campus`,
      );
    }

    // Step 3: Verify guardian is archived
    if (!guardian.isArchived) {
      throw new BadRequestException(`Guardian with ID ${id} is not archived`);
    }

    // Step 4: Restore guardian + emit audit row atomically.
    guardian.restore();

    await this.unitOfWork.run(async (tx) => {
      await tx.updateGuardian(guardian.id, {
        isArchived: false,
        updatedAt: guardian.updatedAt,
      });
      this.logger.log(`Guardian restored in transaction: ${id}`);

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "RESTORE_GUARDIAN",
        targetType: "guardian",
        targetId: guardian.id,
        campusId: guardian.campusId,
        context: { actorName: currentUser.profile?.fullName ?? null },
        beforeValue: { isArchived: true },
        afterValue: { isArchived: false },
      });
    });

    this.logger.log(`Guardian restored successfully: ${id}`);
    return guardian;
  }
}
