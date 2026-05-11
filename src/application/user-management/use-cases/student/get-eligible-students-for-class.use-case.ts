import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { Student } from "@/domain/user-management/entities/student.entity";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";
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
  includeStatuses?: StudentStatus[];
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
    const { classId, campusId, params, search, includeStatuses } = input;

    // D5 / AC-12: cross-campus and missing both surface as 404 so existence
    // cannot be probed by clients in another campus. Matches the
    // transfer-student / get-class-enrollments precedent.
    const targetClass = await this.classRepository.findById(classId);
    if (!targetClass || targetClass.campusId !== campusId) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // D6: default includeStatuses to [ACTIVE] when caller omits the param.
    // Per-element allow-list (ACTIVE, WAITING, TRIAL, DEFERRED) is enforced
    // at the DTO layer, so anything reaching here is already safe.
    const statuses =
      includeStatuses && includeStatuses.length > 0
        ? includeStatuses
        : [StudentStatus.ACTIVE];

    // Hand-build filterInfo so the repo's narrow allowed-filter surface
    // (fullName, status) gets exactly the user-driven values we want.
    // executeQuery reads filterInfo before parsing the `filter` JSON string,
    // so we can populate it directly without re-stringifying.
    const filters: Record<
      string,
      string | number | boolean | FilterConditionDto
    > = {
      status: { in: statuses },
    };
    if (typeof search === "string" && search.trim().length > 0) {
      filters.fullName = { ilike: search.trim() };
    }
    params.filterInfo = { filters };

    this.logger.log(
      `Fetching eligible students for class ${classId} (campus ${campusId}): ` +
        `statuses=[${statuses.join(",")}] search=${search ?? "<none>"} ` +
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
