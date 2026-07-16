import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  MedicationAdministrationOccurrence,
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineEntry,
} from "@/domain/medication";

export interface MedicationRequestListFilters {
  studentId?: string;
  status?: MedicationRequestStatus;
  fromDate?: string | Date;
  toDate?: string | Date;
}

export interface StaffMedicationRequestListParams extends StandardRequest {
  status?: MedicationRequestStatus;
  studentId?: string;
  classId?: string;
  fromDate?: string | Date;
  toDate?: string | Date;
  search?: string;
}

export interface StaffMedicationRequestRepositoryParams
  extends StaffMedicationRequestListParams {
  enrollmentReferenceDate: Date;
}

export interface StudentMedicationHistoryParams extends StandardRequest {
  status?: MedicationRequestStatus;
  fromDate?: string | Date;
  toDate?: string | Date;
}

export interface MedicationRequestHealthCenterSummaryCounts {
  pendingRequests: number;
  needsMoreInfo: number;
}

export interface MedicationRequestHealthCenterReviewCountParams {
  actualDate: Date;
  enrollmentReferenceDate: Date;
  classId?: string;
}

export interface MedicationLifecycleCandidate {
  request: MedicationRequest;
  timeZone: string;
}

export interface MedicationLifecycleCandidateQuery {
  now: Date;
  limit: number;
  afterId?: string;
}

export interface MedicationTerminalTransition {
  requestId: string;
  campusId: string;
  sourceStatuses: MedicationRequestStatus[];
  targetStatus:
    | MedicationRequestStatus.COMPLETED
    | MedicationRequestStatus.EXPIRED;
  effectiveAt: Date;
  updatedAt: Date;
}

export abstract class MedicationRequestRepository {
  abstract findByIdInCampus(
    campusId: string,
    id: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null>;

  abstract findByCampusId(
    campusId: string,
    params: StaffMedicationRequestRepositoryParams,
  ): Promise<PaginatedResult<MedicationRequest>>;

  abstract findDetailByIdInCampus(
    campusId: string,
    id: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null>;

  abstract findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StudentMedicationHistoryParams,
  ): Promise<PaginatedResult<MedicationRequest>>;

  abstract countHealthCenterSummaryByCampus(
    campusId: string,
  ): Promise<MedicationRequestHealthCenterSummaryCounts>;

  abstract countHealthCenterRequestsNeedingReview(
    campusId: string,
    params: MedicationRequestHealthCenterReviewCountParams,
  ): Promise<number>;

  abstract findByIdForRequesterGuardian(
    campusId: string,
    requesterGuardianId: string,
    id: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null>;

  abstract findDetailByIdForRequesterGuardian(
    campusId: string,
    requesterGuardianId: string,
    id: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null>;

  abstract findByRequesterGuardianId(
    campusId: string,
    requesterGuardianId: string,
    filters?: MedicationRequestListFilters,
  ): Promise<MedicationRequest[]>;

  abstract create(
    medicationRequest: MedicationRequest,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest>;

  abstract update(
    medicationRequest: MedicationRequest,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest>;

  abstract updateForRequesterGuardianIfStatusIn(
    medicationRequest: MedicationRequest,
    campusId: string,
    requesterGuardianId: string,
    allowedStatuses: MedicationRequestStatus[],
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null>;

  abstract updateInCampusIfStatusIn(
    medicationRequest: MedicationRequest,
    campusId: string,
    allowedStatuses: MedicationRequestStatus[],
    tx?: AppTransactionClient,
  ): Promise<MedicationRequest | null>;

  abstract createOccurrences(
    occurrences: MedicationAdministrationOccurrence[],
    tx?: AppTransactionClient,
  ): Promise<number>;

  abstract addTimelineEntry(
    timelineEntry: MedicationRequestTimelineEntry,
    tx?: AppTransactionClient,
  ): Promise<MedicationRequestTimelineEntry>;

  abstract findLifecycleCandidates(
    query: MedicationLifecycleCandidateQuery,
  ): Promise<MedicationLifecycleCandidate[]>;

  abstract transitionToTerminalIfStatusIn(
    transition: MedicationTerminalTransition,
    tx?: AppTransactionClient,
  ): Promise<boolean>;
}
