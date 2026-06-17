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
import { StaffRepository } from "@/application/user-management/ports/staff.repository";

import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaffErrorCode } from "../../class-staff-error-codes";

export interface AssignStaffToClassInput {
  campusId: string;
  classId: string;
  staffId: string;
  role: ClassStaffRole;
}

@Injectable()
export class AssignStaffToClassUseCase {
  private readonly logger = new Logger(AssignStaffToClassUseCase.name);

  constructor(
    @Inject("CLASS_STAFF_REPOSITORY")
    private readonly classStaffRepository: ClassStaffRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: AssignStaffToClassInput,
    currentUser: User,
  ): Promise<ClassStaff> {
    this.logger.log(
      `Assigning staff ${input.staffId} to class ${input.classId} as ${input.role}`,
    );

    // Step 1: Validate class exists + campus match.
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }
    if (classEntity.campusId !== input.campusId) {
      throw new BadRequestException(`Class does not belong to this campus`);
    }

    // Step 2: Validate staff exists + campus match.
    const staff = await this.staffRepository.findById(input.staffId);
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${input.staffId} not found`);
    }
    if (staff.campusId !== input.campusId) {
      throw new BadRequestException(`Staff does not belong to this campus`);
    }

    // Step 3: Reject duplicate (classId, staffId) pair.
    const existingAssignment = await this.classStaffRepository.findByPair(
      input.classId,
      input.staffId,
    );
    if (existingAssignment) {
      throw new ConflictException(ClassStaffErrorCode.STAFF_ALREADY_ASSIGNED);
    }

    // Step 4: Domain invariant — at most one HOMEROOM per class. The DB partial
    // unique index `class_staff_homeroom_unique` is the backstop; this typed
    // check returns a clean 409 instead of a raw unique-violation error.
    if (input.role === ClassStaffRole.HOMEROOM) {
      const existingHomeroom =
        await this.classStaffRepository.findHomeroomByClassId(input.classId);
      if (existingHomeroom) {
        throw new ConflictException(
          ClassStaffErrorCode.HOMEROOM_ALREADY_ASSIGNED,
        );
      }
    }

    // Step 5: Persist + emit audit row atomically.
    const classStaff = ClassStaff.create({
      classId: input.classId,
      staffId: input.staffId,
      role: input.role,
    });

    await this.unitOfWork.run(async (tx) => {
      await tx.createClassStaff({
        classId: classStaff.classId,
        staffId: classStaff.staffId,
        role: classStaff.role,
        createdAt: classStaff.createdAt,
        updatedAt: classStaff.updatedAt,
      });

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "ASSIGN_STAFF_TO_CLASS",
        targetType: "staff",
        targetId: classStaff.staffId,
        campusId: input.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          classId: classStaff.classId,
          role: classStaff.role,
        },
      });
    });

    this.logger.log(
      `Staff ${input.staffId} assigned to class ${input.classId} as ${input.role}`,
    );
    return classStaff;
  }
}
