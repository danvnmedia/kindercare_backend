import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";

export interface ReorderGuardianRelationshipTypesInput {
  campusId: string;
  ids: string[];
}

@Injectable()
export class ReorderGuardianRelationshipTypesUseCase {
  private readonly logger = new Logger(
    ReorderGuardianRelationshipTypesUseCase.name,
  );

  constructor(
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly repository: GuardianRelationshipTypeRepository,
  ) {}

  async execute(
    input: ReorderGuardianRelationshipTypesInput,
  ): Promise<GuardianRelationshipType[]> {
    this.logger.log(
      `Reordering ${input.ids.length} guardian relationship types`,
    );

    const missingIds: string[] = [];
    for (const id of input.ids) {
      const type = await this.repository.findById(id);
      if (!type) {
        missingIds.push(id);
      } else if (type.campusId !== input.campusId) {
        throw new NotFoundException(
          `Guardian relationship type with ID ${id} not found in this campus`,
        );
      }
    }

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Guardian relationship type(s) not found: ${missingIds.join(", ")}`,
      );
    }

    const reordered = await this.repository.reorder(input.campusId, input.ids);

    this.logger.log(
      `Successfully reordered ${reordered.length} guardian relationship types`,
    );

    return reordered;
  }
}
