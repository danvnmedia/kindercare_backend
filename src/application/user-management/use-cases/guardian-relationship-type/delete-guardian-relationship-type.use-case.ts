import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";

@Injectable()
export class DeleteGuardianRelationshipTypeUseCase {
  private readonly logger = new Logger(
    DeleteGuardianRelationshipTypeUseCase.name,
  );

  constructor(
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly repository: GuardianRelationshipTypeRepository,
  ) {}

  /**
   * Soft delete guardian relationship type by archiving it.
   */
  async execute(id: string): Promise<GuardianRelationshipType> {
    try {
      this.logger.log(`Archiving guardian relationship type: ${id}`);

      const type = await this.repository.findById(id);
      if (!type) {
        throw new NotFoundException(
          `Guardian relationship type with ID "${id}" not found`,
        );
      }

      if (type.isArchived) {
        this.logger.log(`Guardian relationship type ${id} is already archived`);
        return type;
      }

      type.archive();

      const archived = await this.repository.update(type);
      this.logger.log(`Guardian relationship type archived: ${archived.id}`);

      return archived;
    } catch (error) {
      this.logger.error(
        `Failed to archive guardian relationship type: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
