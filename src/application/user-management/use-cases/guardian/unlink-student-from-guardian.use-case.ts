import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { StudentRepository } from "../../ports/student.repository";
import { GuardianRepository } from "../../ports/guardian.repository";

export interface UnlinkStudentFromGuardianInput {
  guardianId: string;
  studentId: string;
}

@Injectable()
export class UnlinkStudentFromGuardianUseCase {
  private readonly logger = new Logger(UnlinkStudentFromGuardianUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: UnlinkStudentFromGuardianInput,
    currentUser: User,
  ): Promise<void> {
    try {
      this.logger.log(
        `Unlinking student ${input.studentId} from guardian ${input.guardianId}`,
      );

      const guardian = await this.guardianRepository.findById(input.guardianId);
      if (!guardian) {
        throw new NotFoundException(
          `Guardian with ID ${input.guardianId} not found`,
        );
      }

      const student = await this.studentRepository.findById(input.studentId);
      if (!student) {
        throw new NotFoundException(
          `Student with ID ${input.studentId} not found`,
        );
      }

      const existingGuardians =
        await this.studentRepository.getStudentGuardians(input.studentId);
      const existingRelation = existingGuardians.find(
        (g) => g.guardianId === input.guardianId,
      );
      if (!existingRelation) {
        throw new NotFoundException(
          `Student ${input.studentId} is not linked to guardian ${input.guardianId}`,
        );
      }

      await this.unitOfWork.run(async (tx) => {
        await tx.removeGuardians(input.studentId, [input.guardianId]);

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "UNLINK_GUARDIAN_FROM_STUDENT",
          targetType: "student",
          targetId: input.studentId,
          campusId: student.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            studentId: input.studentId,
            studentName: student.fullName,
            guardianId: input.guardianId,
            guardianName: guardian.fullName,
            relationshipId: existingRelation.relationship,
            relationshipType: existingRelation.relationshipName,
          },
        });
      });

      this.logger.log(
        `Successfully unlinked student ${input.studentId} from guardian ${input.guardianId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to unlink student from guardian: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
