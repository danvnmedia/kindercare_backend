import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";

export interface RemoveStaffFromClassInput {
  campusId: string;
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
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(input: RemoveStaffFromClassInput): Promise<void> {
    try {
      this.logger.log(
        `Removing staff ${input.staffId} from class ${input.classId} for subject ${input.subjectId}`,
      );

      // Step 1: Validate class exists
      const classEntity = await this.classRepository.findById(input.classId);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${input.classId} not found`);
      }

      // Step 1b: Validate class belongs to the specified campus
      if (classEntity.campusId !== input.campusId) {
        throw new BadRequestException(`Class does not belong to this campus`);
      }

      // Step 2: Check if assignment exists
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

      // Step 3: Delete assignment
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
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
