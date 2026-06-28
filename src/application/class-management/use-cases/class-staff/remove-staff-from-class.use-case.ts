import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { User } from "@/domain/user-management/user.entity";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";

import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaffErrorCode } from "../../class-staff-error-codes";

export interface RemoveStaffFromClassInput {
  campusId: string;
  classId: string;
  staffId: string;
}

@Injectable()
export class RemoveStaffFromClassUseCase {
  private readonly logger = new Logger(RemoveStaffFromClassUseCase.name);

  constructor(
    @Inject("CLASS_STAFF_REPOSITORY")
    private readonly classStaffRepository: ClassStaffRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: RemoveStaffFromClassInput,
    currentUser: User,
  ): Promise<void> {
    this.logger.log(
      `Removing staff ${input.staffId} from class ${input.classId}`,
    );

    // Step 1: Validate class exists + campus match.
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }
    if (classEntity.campusId !== input.campusId) {
      throw new BadRequestException(`Class does not belong to this campus`);
    }

    // Step 2: Lookup the existing assignment by natural key (classId, staffId).
    // Missing → 404 STAFF_NOT_FOUND_IN_CLASS. The role lives on the existing
    // row, so capture it here BEFORE deletion for the audit context.
    const existing = await this.classStaffRepository.findByPair(
      input.classId,
      input.staffId,
    );
    if (!existing) {
      throw new NotFoundException(ClassStaffErrorCode.STAFF_NOT_FOUND_IN_CLASS);
    }

    const role = existing.role;

    // Step 3: Delete row + emit audit row atomically.
    await this.unitOfWork.run(async (tx) => {
      await tx.deleteClassStaff(input.classId, input.staffId);

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "REMOVE_STAFF_FROM_CLASS",
        targetType: "staff",
        targetId: input.staffId,
        campusId: input.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          classId: input.classId,
          role,
        },
      });
    });

    this.logger.log(
      `Staff ${input.staffId} removed from class ${input.classId}`,
    );
  }
}
