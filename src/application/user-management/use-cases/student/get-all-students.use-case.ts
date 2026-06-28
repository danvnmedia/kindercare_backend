import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { StudentRepository } from "../../ports/student.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { Student } from "@/domain/user-management/entities/student.entity";

export interface GetAllStudentsInput {
  campusId: string;
  params: StandardRequest;
}

@Injectable()
export class GetAllStudentsUseCase {
  private readonly logger = new Logger(GetAllStudentsUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(input: GetAllStudentsInput): Promise<PaginatedResult<Student>> {
    const { campusId, params } = input;

    if (!campusId) {
      throw new BadRequestException("Campus ID is required to fetch students");
    }

    try {
      this.logger.log(
        `Fetching students for campus ${campusId}: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.studentRepository.findAll(params, { campusId });

      this.logger.log(
        `Found ${result.pagination.count} students in campus ${campusId}, returning page ${result.pagination.currentPage}`,
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
