import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { StudentHealthCheckup } from "@/domain/student-health";

export interface StudentHealthCheckupListParams extends StandardRequest {
  includeArchived?: boolean;
}

export abstract class StudentHealthCheckupRepository {
  abstract findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StudentHealthCheckupListParams,
  ): Promise<PaginatedResult<StudentHealthCheckup>>;

  abstract findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    checkupId: string,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup | null>;

  abstract create(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup>;

  abstract archiveIfActive(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup | null>;

  abstract updateIfActive(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup | null>;
}
