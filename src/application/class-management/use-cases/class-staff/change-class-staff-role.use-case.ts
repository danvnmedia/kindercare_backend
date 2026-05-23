import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { User } from "@/domain/user-management/user.entity";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";

import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaffErrorCode } from "../../class-staff-error-codes";

export interface ChangeClassStaffRoleInput {
  campusId: string;
  classId: string;
  staffId: string;
  newRole: ClassStaffRole;
}

@Injectable()
export class ChangeClassStaffRoleUseCase {
  private readonly logger = new Logger(ChangeClassStaffRoleUseCase.name);

  constructor(
    @Inject("CLASS_STAFF_REPOSITORY")
    private readonly classStaffRepository: ClassStaffRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: ChangeClassStaffRoleInput,
    currentUser: User,
  ): Promise<ClassStaff> {
    this.logger.log(
      `Changing role for staff ${input.staffId} in class ${input.classId} to ${input.newRole}`,
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
    const existing = await this.classStaffRepository.findByPair(
      input.classId,
      input.staffId,
    );
    if (!existing) {
      throw new NotFoundException(ClassStaffErrorCode.STAFF_NOT_FOUND_IN_CLASS);
    }

    // Step 3: No-op short-circuit — same role means no DB write, no audit row,
    // and a stable response shape for the FE (Scenario 6 of the spec).
    if (input.newRole === existing.role) {
      this.logger.log(
        `No-op: staff ${input.staffId} already holds role ${input.newRole} in class ${input.classId}`,
      );
      return existing;
    }

    // Step 4: Domain invariant — at most one HOMEROOM per class. The DB partial
    // unique index `class_staff_homeroom_unique` is the backstop; this typed
    // check returns a clean 409 instead of a raw unique-violation error.
    // Only fires on actual promotions TO HOMEROOM (Step 3 already returned for
    // the no-op case, and demotions / lateral moves cannot create a duplicate).
    if (input.newRole === ClassStaffRole.HOMEROOM) {
      const existingHomeroom =
        await this.classStaffRepository.findHomeroomByClassId(input.classId);
      if (existingHomeroom) {
        throw new ConflictException(
          ClassStaffErrorCode.HOMEROOM_ALREADY_ASSIGNED,
        );
      }
    }

    // Step 5: Compute the updated entity via the immutable domain method.
    // `previousRole` is captured before persistence so the audit row carries
    // the pre-change value even though the underlying row will already be
    // updated by audit emission time.
    const previousRole = existing.role;
    const updated = existing.changeRole(input.newRole);

    // Step 6: Persist + emit audit row atomically.
    await this.unitOfWork.run(async (tx) => {
      await tx.updateClassStaff(input.classId, input.staffId, {
        role: updated.role,
        updatedAt: updated.updatedAt,
      });

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "CHANGE_STAFF_ROLE",
        targetType: "staff",
        targetId: input.staffId,
        campusId: input.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          classId: input.classId,
          previousRole,
          newRole: updated.role,
        },
      });
    });

    this.logger.log(
      `Role for staff ${input.staffId} in class ${input.classId} changed from ${previousRole} to ${updated.role}`,
    );
    return updated;
  }
}
