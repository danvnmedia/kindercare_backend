import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { GuardianRelationshipType } from "@/domain/user-management/entities/guardian-relationship-type.entity";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export interface GetAllGuardianRelationshipTypesInput {
  campusId: string;
  params: StandardRequest;
}

@Injectable()
export class GetAllGuardianRelationshipTypesUseCase {
  private readonly logger = new Logger(
    GetAllGuardianRelationshipTypesUseCase.name,
  );

  constructor(
    @Inject("GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY")
    private readonly repository: GuardianRelationshipTypeRepository,
  ) {}

  async execute(
    input: GetAllGuardianRelationshipTypesInput,
  ): Promise<PaginatedResult<GuardianRelationshipType>> {
    const { campusId, params } = input;

    if (!campusId) {
      throw new BadRequestException(
        "Campus ID is required to fetch guardian relationship types",
      );
    }

    this.logger.log(
      `Getting all guardian relationship types for campus ${campusId}`,
    );

    return await this.repository.findAll(params, { campusId });
  }
}
