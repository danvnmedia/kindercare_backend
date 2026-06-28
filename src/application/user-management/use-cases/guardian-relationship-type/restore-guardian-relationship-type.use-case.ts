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
export class RestoreGuardianRelationshipTypeUseCase {
  private readonly logger = new Logger(
    RestoreGuardianRelationshipTypeUseCase.name,
  );

  constructor(
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly repository: GuardianRelationshipTypeRepository,
  ) {}

  /**
   * Restore an archived guardian relationship type.
   */
  async execute(id: string): Promise<GuardianRelationshipType> {
    try {
      this.logger.log(`Restoring guardian relationship type: ${id}`);

      const type = await this.repository.findById(id);
      if (!type) {
        throw new NotFoundException(
          `Guardian relationship type with ID "${id}" not found`,
        );
      }

      if (!type.isArchived) {
        this.logger.log(`Guardian relationship type ${id} is not archived`);
        return type;
      }

      type.unarchive();

      const restored = await this.repository.update(type);
      this.logger.log(`Guardian relationship type restored: ${restored.id}`);

      return restored;
    } catch (error) {
      this.logger.error(
        `Failed to restore guardian relationship type: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
