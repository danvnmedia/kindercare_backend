import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ClassRepository } from "../../ports/class.repository";

@Injectable()
export class GetClassByIdUseCase {
  private readonly logger = new Logger(GetClassByIdUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(id: string): Promise<Class> {
    try {
      this.logger.log(`Fetching class by ID: ${id}`);

      const classEntity = await this.classRepository.findById(id);

      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${id} not found`);
      }

      this.logger.log(`Found class: ${classEntity.name}`);
      return classEntity;
    } catch (error) {
      this.logger.error(`Failed to fetch class: ${error.message}`, error.stack);
      throw error;
    }
  }
}
