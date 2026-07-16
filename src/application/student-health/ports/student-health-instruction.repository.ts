import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  StudentHealthInstruction,
  StudentHealthInstructionStatus,
} from "@/domain/student-health";

export interface HealthCenterStudentSummary {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface HealthCenterClassSummary {
  id: string;
  name: string;
}

export interface HealthCenterInstructionItem {
  instruction: StudentHealthInstruction;
  student: HealthCenterStudentSummary;
  class: HealthCenterClassSummary | null;
}

export interface HealthCenterInstructionScope {
  campusId: string;
  referenceDate: Date;
  classId?: string;
}

export interface HealthCenterInstructionListParams
  extends HealthCenterInstructionScope {
  offset: number;
  limit: number;
}

export interface HealthCenterInstructionListResult {
  data: HealthCenterInstructionItem[];
  total: number;
}

export interface StudentHealthInstructionListParams extends StandardRequest {
  status?: StudentHealthInstructionStatus;
  date?: string;
  includeArchived?: boolean;
}

export abstract class StudentHealthInstructionRepository {
  abstract findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StudentHealthInstructionListParams,
  ): Promise<PaginatedResult<StudentHealthInstruction>>;

  abstract findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    instructionId: string,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthInstruction | null>;

  abstract findActiveByStudentInCampus(
    campusId: string,
    studentId: string,
    referenceDate: Date,
  ): Promise<StudentHealthInstruction[]>;

  abstract findActiveByStudentsInCampus(
    campusId: string,
    studentIds: string[],
    referenceDate: Date,
  ): Promise<StudentHealthInstruction[]>;

  abstract findActiveForHealthCenter(
    params: HealthCenterInstructionListParams,
  ): Promise<HealthCenterInstructionListResult>;

  abstract countActiveForHealthCenter(
    params: HealthCenterInstructionScope,
  ): Promise<number>;

  abstract create(
    instruction: StudentHealthInstruction,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthInstruction>;

  abstract archiveIfActive(
    instruction: StudentHealthInstruction,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthInstruction | null>;

  abstract updateIfActive(
    instruction: StudentHealthInstruction,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthInstruction | null>;
}
