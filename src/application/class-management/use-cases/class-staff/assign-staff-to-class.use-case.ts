import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SubjectRepository } from "../../ports/subject.repository";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";

export interface AssignStaffToClassInput {
  classId: string;
  staffId: string;
  subjectId: string;
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
    @Inject("SUBJECT_REPOSITORY")
    private readonly subjectRepository: SubjectRepository,
  ) {}

  async execute(input: AssignStaffToClassInput): Promise<ClassStaff> {
    try {
      this.logger.log(
        `Assigning staff ${input.staffId} to class ${input.classId} for subject ${input.subjectId}`,
      );

      // Step 1: Validate class exists
      const classEntity = await this.classRepository.findById(input.classId);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${input.classId} not found`);
      }

      // Step 2: Validate staff exists
      const staff = await this.staffRepository.findById(input.staffId);
      if (!staff) {
        throw new NotFoundException(`Staff with ID ${input.staffId} not found`);
      }

      // Step 3: Validate subject exists
      const subject = await this.subjectRepository.findById(input.subjectId);
      if (!subject) {
        throw new NotFoundException(
          `Subject with ID ${input.subjectId} not found`,
        );
      }

      // Step 4: Check for duplicate assignment
      const existingAssignment =
        await this.classStaffRepository.findByCompositeKey(
          input.classId,
          input.staffId,
          input.subjectId,
        );
      if (existingAssignment) {
        throw new ConflictException(
          `Staff is already assigned to this class for this subject`,
        );
      }

      // Step 5: Create and save assignment
      const classStaff = ClassStaff.create({
        classId: input.classId,
        staffId: input.staffId,
        subjectId: input.subjectId,
      });

      const savedAssignment = await this.classStaffRepository.save(classStaff);
      this.logger.log(`Staff assignment created for class ${input.classId}`);

      return savedAssignment;
    } catch (error) {
      this.logger.error(
        `Failed to assign staff: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
