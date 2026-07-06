import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { User } from "@/domain/user-management/user.entity";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";

/**
 * Archive Guardian Use Case (Soft Delete)
 *
 * Performs profile-scoped soft delete by archiving the Guardian row.
 * Global identity lock/deactivation is handled by explicit identity-admin flows.
 */
@Injectable()
export class ArchiveGuardianUseCase {
  private readonly logger = new Logger(ArchiveGuardianUseCase.name);

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
    this.logger.log(`Archiving guardian: ${id}`);

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

    // Step 3: Archive guardian + emit audit row atomically.
    guardian.archive();

    await this.unitOfWork.run(async (tx) => {
      await tx.updateGuardian(guardian.id, {
        isArchived: true,
        updatedAt: guardian.updatedAt,
      });
      this.logger.log(`Guardian archived in transaction: ${id}`);

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "ARCHIVE_GUARDIAN",
        targetType: "guardian",
        targetId: guardian.id,
        campusId: guardian.campusId,
        context: { actorName: currentUser.profile?.fullName ?? null },
        beforeValue: { isArchived: false },
        afterValue: { isArchived: true },
      });
    });

    this.logger.log(`Guardian archived successfully: ${id}`);
    return guardian;
  }
}
