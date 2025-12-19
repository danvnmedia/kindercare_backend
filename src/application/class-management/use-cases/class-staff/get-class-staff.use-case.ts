import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";

@Injectable()
export class GetClassStaffUseCase {
  private readonly logger = new Logger(GetClassStaffUseCase.name);

  constructor(
    @Inject("CLASS_STAFF_REPOSITORY")
    private readonly classStaffRepository: ClassStaffRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(classId: string): Promise<ClassStaff[]> {
    try {
      this.logger.log(`Fetching staff for class: ${classId}`);

      // Validate class exists
      const classEntity = await this.classRepository.findById(classId);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      const assignments =
        await this.classStaffRepository.findByClassId(classId);

      this.logger.log(
        `Found ${assignments.length} staff assignments for class ${classId}`,
      );

      return assignments;
    } catch (error) {
      this.logger.error(
        `Failed to fetch class staff: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
