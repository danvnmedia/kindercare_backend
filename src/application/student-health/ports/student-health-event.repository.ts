import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  StudentHealthEvent,
  StudentHealthEventStatus,
  StudentHealthEventType,
} from "@/domain/student-health";

import {
  HealthCenterClassSummary,
  HealthCenterStudentSummary,
} from "./student-health-instruction.repository";

export interface HealthCenterEventItem {
  event: StudentHealthEvent;
  student: HealthCenterStudentSummary;
  class: HealthCenterClassSummary | null;
}

export interface HealthCenterEventScope {
  campusId: string;
  referenceDate: Date;
  visibleUntil: Date;
  classId?: string;
}

export interface HealthCenterEventListParams extends HealthCenterEventScope {
  offset: number;
  limit: number;
}

export interface HealthCenterEventListResult {
  data: HealthCenterEventItem[];
  total: number;
}

export interface StudentHealthEventListParams extends StandardRequest {
  status?: StudentHealthEventStatus;
  eventType?: StudentHealthEventType;
  includeArchived?: boolean;
}

export abstract class StudentHealthEventRepository {
  abstract findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StudentHealthEventListParams,
  ): Promise<PaginatedResult<StudentHealthEvent>>;

  abstract findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    eventId: string,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent | null>;

  abstract findOpenForHealthCenter(
    params: HealthCenterEventListParams,
  ): Promise<HealthCenterEventListResult>;

  abstract countOpenForHealthCenter(
    params: HealthCenterEventScope,
  ): Promise<number>;

  abstract create(
    event: StudentHealthEvent,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent>;

  abstract archiveIfActive(
    event: StudentHealthEvent,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent | null>;

  abstract updateIfActive(
    event: StudentHealthEvent,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent | null>;
}
