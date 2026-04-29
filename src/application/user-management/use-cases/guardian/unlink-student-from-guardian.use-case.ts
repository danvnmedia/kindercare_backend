import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
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
  ) {}

  async execute(input: UnlinkStudentFromGuardianInput): Promise<void> {
    try {
      this.logger.log(
        `Unlinking student ${input.studentId} from guardian ${input.guardianId}`,
      );

      // Check guardian exists
      const guardian = await this.guardianRepository.findById(input.guardianId);
      if (!guardian) {
        throw new NotFoundException(
          `Guardian with ID ${input.guardianId} not found`,
        );
      }

      // Check student exists
      const student = await this.studentRepository.findById(input.studentId);
      if (!student) {
        throw new NotFoundException(
          `Student with ID ${input.studentId} not found`,
        );
      }

      // Check if relationship exists
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

      // Remove the link (reuses existing student repository method)
      await this.studentRepository.removeGuardians(input.studentId, [
        input.guardianId,
      ]);

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
