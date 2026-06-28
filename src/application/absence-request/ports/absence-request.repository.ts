import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { AbsencePeriod, AbsenceRequest } from "@/domain/absence-request";

export interface AbsenceRequestFindManyOptions {
  scope?: Record<string, unknown>;
}

export abstract class AbsenceRequestRepository {
  abstract findByIdInCampus(
    campusId: string,
    id: string,
  ): Promise<AbsenceRequest | null>;

  abstract findByCampusId(
    campusId: string,
    params: StandardRequest,
    options?: AbsenceRequestFindManyOptions,
  ): Promise<PaginatedResult<AbsenceRequest>>;

  abstract findByRequesterGuardianId(
    campusId: string,
    requesterGuardianId: string,
  ): Promise<AbsenceRequest[]>;

  abstract findActiveOverlaps(
    campusId: string,
    studentId: string,
    period: AbsencePeriod,
  ): Promise<AbsenceRequest[]>;

  abstract save(absenceRequest: AbsenceRequest): Promise<AbsenceRequest>;

  abstract update(absenceRequest: AbsenceRequest): Promise<AbsenceRequest>;
}
