import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { ClassStaffRepository } from "../../ports/class-staff.repository";

export interface RemoveStaffFromClassInput {
  classId: string;
  staffId: string;
  subjectId: string;
}

@Injectable()
export class RemoveStaffFromClassUseCase {
  private readonly logger = new Logger(RemoveStaffFromClassUseCase.name);

  constructor(
    @Inject("CLASS_STAFF_REPOSITORY")
    private readonly classStaffRepository: ClassStaffRepository,
  ) {}

  async execute(input: RemoveStaffFromClassInput): Promise<void> {
    try {
      this.logger.log(
        `Removing staff ${input.staffId} from class ${input.classId} for subject ${input.subjectId}`,
      );

      // Step 1: Check if assignment exists
      const assignment = await this.classStaffRepository.findByCompositeKey(
        input.classId,
        input.staffId,
        input.subjectId,
      );
      if (!assignment) {
        throw new NotFoundException(
          `Staff assignment not found for this class and subject`,
        );
      }

      // Step 2: Delete assignment
      await this.classStaffRepository.delete(
        input.classId,
        input.staffId,
        input.subjectId,
      );

      this.logger.log(`Staff assignment removed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to remove staff: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
