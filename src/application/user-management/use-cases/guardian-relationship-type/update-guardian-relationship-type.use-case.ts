import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  GuardianRelationshipType,
  UpdateGuardianRelationshipTypeData,
} from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";

export interface UpdateGuardianRelationshipTypeInput {
  name?: string;
  description?: string | null;
  isArchived?: boolean;
  order?: number;
}

@Injectable()
export class UpdateGuardianRelationshipTypeUseCase {
  private readonly logger = new Logger(
    UpdateGuardianRelationshipTypeUseCase.name,
  );

  constructor(
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly repository: GuardianRelationshipTypeRepository,
  ) {}

  async execute(
    id: string,
    input: UpdateGuardianRelationshipTypeInput,
  ): Promise<GuardianRelationshipType> {
    try {
      this.logger.log(`Updating guardian relationship type: ${id}`);

      const type = await this.repository.findById(id);
      if (!type) {
        throw new NotFoundException(
          `Guardian relationship type with ID "${id}" not found`,
        );
      }

      // Check for duplicate name if name is being changed
      if (input.name && input.name !== type.name) {
        const existingByName = await this.repository.findByName(
          type.campusId,
          input.name,
        );
        if (existingByName && existingByName.id !== id) {
          throw new ConflictException(
            `Guardian relationship type "${input.name}" already exists in this campus`,
          );
        }
      }

      // Validate order uniqueness if being changed
      if (input.order !== undefined && input.order !== type.order) {
        const existingByOrder = await this.repository.findByOrderAndCampus(
          input.order,
          type.campusId,
        );
        if (existingByOrder && existingByOrder.id !== id) {
          throw new ConflictException(
            `A guardian relationship type with order ${input.order} already exists in this campus`,
          );
        }
      }

      const updateData: UpdateGuardianRelationshipTypeData = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
      }
      if (input.isArchived !== undefined) {
        updateData.isArchived = input.isArchived;
      }
      if (input.order !== undefined) {
        updateData.order = input.order;
      }

      type.update(updateData);

      const updated = await this.repository.update(type);
      this.logger.log(`Guardian relationship type updated: ${updated.id}`);

      return updated;
    } catch (error) {
      this.logger.error(
        `Failed to update guardian relationship type: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
