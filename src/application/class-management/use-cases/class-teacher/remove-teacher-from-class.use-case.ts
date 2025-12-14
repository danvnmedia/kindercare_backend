import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ClassTeacherRepository } from "../../ports/class-teacher.repository";

export interface RemoveTeacherFromClassInput {
  classId: string;
  teacherId: string;
  subjectId: string;
}

@Injectable()
export class RemoveTeacherFromClassUseCase {
  private readonly logger = new Logger(RemoveTeacherFromClassUseCase.name);

  constructor(
    @Inject("CLASS_TEACHER_REPOSITORY")
    private readonly classTeacherRepository: ClassTeacherRepository,
  ) {}

  async execute(input: RemoveTeacherFromClassInput): Promise<void> {
    try {
      this.logger.log(
        `Removing teacher ${input.teacherId} from class ${input.classId} for subject ${input.subjectId}`,
      );

      // Step 1: Check if assignment exists
      const assignment = await this.classTeacherRepository.findByCompositeKey(
        input.classId,
        input.teacherId,
        input.subjectId,
      );
      if (!assignment) {
        throw new NotFoundException(
          `Teacher assignment not found for this class and subject`,
        );
      }

      // Step 2: Delete assignment
      await this.classTeacherRepository.delete(
        input.classId,
        input.teacherId,
        input.subjectId,
      );

      this.logger.log(`Teacher assignment removed successfully`);
    } catch (error) {
      this.logger.error(`Failed to remove teacher: ${error.message}`, error.stack);
      throw error;
    }
  }
}
