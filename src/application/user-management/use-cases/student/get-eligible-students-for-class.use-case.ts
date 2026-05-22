import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { Student } from "@/domain/user-management/entities/student.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { FilterConditionDto } from "@/core/modules/standard-response/dto/filter-schema.dto";

import { StudentRepository } from "../../ports/student.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";

export interface GetEligibleStudentsForClassInput {
  classId: string;
  campusId: string;
  params: StandardRequest;
  search?: string;
}

@Injectable()
export class GetEligibleStudentsForClassUseCase {
  private readonly logger = new Logger(GetEligibleStudentsForClassUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetEligibleStudentsForClassInput,
  ): Promise<PaginatedResult<Student>> {
    const { classId, campusId, params, search } = input;

    // D5: cross-campus and missing both surface as 404 so existence
    // cannot be probed by clients in another campus. Matches the
    // transfer-student / get-class-enrollments precedent.
    const targetClass = await this.classRepository.findById(classId);
    if (!targetClass || targetClass.campusId !== campusId) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // D9: status-based eligibility narrowing is gone. The repo enforces
    // `isArchived=false AND scope.campusId AND NOT EXISTS open Enrollment`;
    // phase narrowing is a client-side concern. We only forward the search
    // term (fullName ilike) through the standard filter surface.
    const filters: Record<
      string,
      string | number | boolean | FilterConditionDto
    > = {};
    if (typeof search === "string" && search.trim().length > 0) {
      filters.fullName = { ilike: search.trim() };
    }
    params.filterInfo = { filters };

    this.logger.log(
      `Fetching eligible students for class ${classId} (campus ${campusId}): ` +
        `search=${search ?? "<none>"} ` +
        `offset=${params.offset ?? 0} limit=${params.limit ?? 10}`,
    );

    const result = await this.studentRepository.findEligibleForClass(
      classId,
      params,
      { campusId },
    );

    this.logger.log(
      `Eligible students for class ${classId}: ${result.pagination.count} total, ` +
        `returning page ${result.pagination.currentPage}`,
    );

    return result;
  }
}
