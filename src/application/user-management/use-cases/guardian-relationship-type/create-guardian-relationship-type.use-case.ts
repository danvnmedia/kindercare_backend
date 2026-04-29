import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";

export interface CreateGuardianRelationshipTypeInput {
  campusId: string;
  name: string;
  description?: string | null;
  isArchived?: boolean;
  order?: number;
}

@Injectable()
export class CreateGuardianRelationshipTypeUseCase {
  private readonly logger = new Logger(
    CreateGuardianRelationshipTypeUseCase.name,
  );

  constructor(
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly repository: GuardianRelationshipTypeRepository,
  ) {}

  async execute(
    input: CreateGuardianRelationshipTypeInput,
  ): Promise<GuardianRelationshipType> {
    try {
      this.logger.log(
        `Creating guardian relationship type: ${input.name} for campus: ${input.campusId}`,
      );

      // Check for duplicate name within the same campus
      const existingByName = await this.repository.findByName(
        input.campusId,
        input.name,
      );
      if (existingByName) {
        throw new ConflictException(
          `Guardian relationship type "${input.name}" already exists in this campus`,
        );
      }

      // Determine order: use provided order or auto-assign using maxOrder + 1
      let order: number;
      if (input.order !== undefined) {
        const existingByOrder = await this.repository.findByOrderAndCampus(
          input.order,
          input.campusId,
        );
        if (existingByOrder) {
          throw new ConflictException(
            `A guardian relationship type with order ${input.order} already exists in this campus`,
          );
        }
        order = input.order;
      } else {
        const maxOrder = await this.repository.getMaxOrder(input.campusId);
        order = maxOrder + 1;
      }

      const type = GuardianRelationshipType.create({
        campusId: input.campusId,
        name: input.name,
        description: input.description ?? null,
        isArchived: input.isArchived,
        order,
      });

      const saved = await this.repository.save(type);
      this.logger.log(`Guardian relationship type created: ${saved.id}`);

      return saved;
    } catch (error) {
      this.logger.error(
        `Failed to create guardian relationship type: ${error.message}`,
        error.stack,
      );
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
