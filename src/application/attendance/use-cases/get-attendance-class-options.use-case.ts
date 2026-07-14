import { Inject, Injectable } from "@nestjs/common";

import {
  AttendanceClassOptionView,
  AttendanceClassOptionsRepository,
} from "@/application/attendance/ports/attendance-class-options.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export interface GetAttendanceClassOptionsInput {
  campusId: string;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class GetAttendanceClassOptionsUseCase {
  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: AttendanceClassOptionsRepository,
  ) {}

  execute(
    input: GetAttendanceClassOptionsInput,
  ): Promise<PaginatedResult<AttendanceClassOptionView>> {
    const search = input.search?.trim();

    return this.classRepository.findAttendanceOptions(input.campusId, {
      search: search || undefined,
      limit: Math.min(Math.max(input.limit ?? 25, 1), 100),
      offset: Math.max(input.offset ?? 0, 0),
    });
  }
}
