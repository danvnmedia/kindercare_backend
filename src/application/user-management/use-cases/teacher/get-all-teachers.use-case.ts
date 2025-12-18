import { Injectable, Inject, Logger } from "@nestjs/common";
import { TeacherRepository } from "../../ports/teacher.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { Teacher } from "@/domain/user-management/entities/teacher.entity";

@Injectable()
export class GetAllTeachersUseCase {
  private readonly logger = new Logger(GetAllTeachersUseCase.name);

  constructor(
    @Inject("TEACHER_REPOSITORY")
    private readonly teacherRepository: TeacherRepository,
  ) {}

  async execute(params: StandardRequest): Promise<PaginatedResult<Teacher>> {
    try {
      this.logger.log(
        `Fetching teachers: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.teacherRepository.findAll(params);

      this.logger.log(
        `Found ${result.pagination.count} teachers, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch teachers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
