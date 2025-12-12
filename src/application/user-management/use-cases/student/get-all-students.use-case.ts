import { Injectable, Inject, Logger } from "@nestjs/common";
import { StudentRepository } from "../../ports/student.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { Student } from "@/domain/user-management/student.entity";

@Injectable()
export class GetAllStudentsUseCase {
  private readonly logger = new Logger(GetAllStudentsUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(params: StandardRequest): Promise<PaginatedResult<Student>> {
    try {
      this.logger.log(
        `Fetching students: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.studentRepository.findAll(params);

      this.logger.log(
        `Found ${result.pagination.count} students, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch students: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
