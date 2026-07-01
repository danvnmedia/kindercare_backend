import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { StudentHealthProfile } from "@/domain/student-health";

export abstract class StudentHealthProfileRepository {
  abstract findByStudentInCampus(
    campusId: string,
    studentId: string,
  ): Promise<StudentHealthProfile | null>;

  abstract getOrCreateEmpty(
    campusId: string,
    studentId: string,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthProfile>;

  abstract update(
    profile: StudentHealthProfile,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthProfile>;
}
