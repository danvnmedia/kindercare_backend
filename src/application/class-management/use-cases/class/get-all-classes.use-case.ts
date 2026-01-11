import { Injectable, Inject, Logger } from "@nestjs/common";
import { ClassRepository } from "../../ports/class.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { Class } from "@/domain/class-management/entities/class.entity";

export interface GetAllClassesInput {
  campusId: string;
  params: StandardRequest;
}

@Injectable()
export class GetAllClassesUseCase {
  private readonly logger = new Logger(GetAllClassesUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(input: GetAllClassesInput): Promise<PaginatedResult<Class>> {
    try {
      this.logger.log(
        `Fetching classes for campus ${input.campusId}: offset=${input.params.offset ?? 0}, limit=${input.params.limit ?? 10}`,
      );

      const result = await this.classRepository.findAll(
        input.campusId,
        input.params,
      );

      this.logger.log(
        `Found ${result.pagination.count} classes, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch classes: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
