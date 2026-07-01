import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { StudentHealthCheckup } from "@/domain/student-health";

export abstract class StudentHealthCheckupRepository {
  abstract findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentHealthCheckup>>;

  abstract findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    checkupId: string,
  ): Promise<StudentHealthCheckup | null>;

  abstract create(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup>;

  abstract update(
    checkup: StudentHealthCheckup,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthCheckup>;
}
