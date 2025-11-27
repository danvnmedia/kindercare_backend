import { Injectable, Inject, Logger } from '@nestjs/common';
import { ParentRepository } from '../../ports/parent.repository';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';
import { PaginatedResult } from '@/core/modules/standard-response/dto/query.dto';
import { Parent } from '@/domain/user-management/parent.entity';

@Injectable()
export class GetAllParentsUseCase {
  private readonly logger = new Logger(GetAllParentsUseCase.name);

  constructor(
    @Inject('PARENT_REPOSITORY')
    private readonly parentRepository: ParentRepository,
  ) {}

  async execute(params: StandardRequest): Promise<PaginatedResult<Parent>> {
    try {
      this.logger.log(
        `Fetching parents: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.parentRepository.findAll(params);

      this.logger.log(
        `Found ${result.pagination.count} parents, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch parents: ${error.message}`, error.stack);
      throw error;
    }
  }
}
