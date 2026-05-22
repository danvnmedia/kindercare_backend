import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";

@Injectable()
export class GetGuardianRelationshipTypeByIdUseCase {
  private readonly logger = new Logger(
    GetGuardianRelationshipTypeByIdUseCase.name,
  );

  constructor(
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly repository: GuardianRelationshipTypeRepository,
  ) {}

  async execute(id: string): Promise<GuardianRelationshipType> {
    this.logger.log(`Getting guardian relationship type by ID: ${id}`);

    const type = await this.repository.findById(id);

    if (!type) {
      throw new NotFoundException(
        `Guardian relationship type with ID "${id}" not found`,
      );
    }

    return type;
  }
}
