import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export interface AttendanceClassOptionView {
  id: string;
  name: string;
  code: string | null;
}

export interface FindAttendanceClassOptionsParams {
  search?: string;
  limit: number;
  offset: number;
}

export abstract class AttendanceClassOptionsRepository {
  abstract findAttendanceOptions(
    campusId: string,
    params: FindAttendanceClassOptionsParams,
  ): Promise<PaginatedResult<AttendanceClassOptionView>>;
}
