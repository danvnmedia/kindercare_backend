import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";

import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { FilterConditionDto } from "@/core/modules/standard-response/dto/filter-schema.dto";

import { StaffRepository } from "../../ports/staff.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";

export interface GetEligibleStaffForClassInput {
  classId: string;
  campusId: string;
  params: StandardRequest;
  search?: string;
}

@Injectable()
export class GetEligibleStaffForClassUseCase {
  private readonly logger = new Logger(GetEligibleStaffForClassUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
  ) {}

  async execute(
    input: GetEligibleStaffForClassInput,
  ): Promise<PaginatedResult<Staff>> {
    const { classId, campusId, params, search } = input;

    // D9: cross-campus and missing both surface as 404 so existence cannot
    // be probed by clients in another campus. Matches the eligible-students
    // / transfer-student precedent.
    const targetClass = await this.classRepository.findById(classId);
    if (!targetClass || targetClass.campusId !== campusId) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    // The repo enforces `isArchived=false AND scope.campusId AND NOT EXISTS
    // classStaff(classId)`. We only forward the search term (fullName ilike)
    // through the standard filter surface.
    const filters: Record<
      string,
      string | number | boolean | FilterConditionDto
    > = {};
    if (typeof search === "string" && search.trim().length > 0) {
      filters.fullName = { ilike: search.trim() };
    }
    params.filterInfo = { filters };

    this.logger.log(
      `Fetching eligible staff for class ${classId} (campus ${campusId}): ` +
        `search=${search ?? "<none>"} ` +
        `offset=${params.offset ?? 0} limit=${params.limit ?? 10}`,
    );

    const result = await this.staffRepository.findEligibleForClass(
      classId,
      params,
      { campusId },
    );

    this.logger.log(
      `Eligible staff for class ${classId}: ${result.pagination.count} total, ` +
        `returning page ${result.pagination.currentPage}`,
    );

    return result;
  }
}
