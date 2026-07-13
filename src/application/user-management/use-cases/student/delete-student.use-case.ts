import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import { StudentRepository } from "../../ports/student.repository";
import { StudentHardDeleteGuardPort } from "../../ports/student-hard-delete-guard.port";
import { StudentNotFoundException } from "@/domain/user-management/exceptions/student-not-found.exception";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { User } from "@/domain/user-management/user.entity";

@Injectable()
export class DeleteStudentUseCase {
  private readonly logger = new Logger(DeleteStudentUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly studentHardDeleteGuard: StudentHardDeleteGuardPort,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(
    id: string,
    campusId?: string,
    currentUser?: User,
  ): Promise<void> {
    try {
      this.logger.log(`Deleting student: ${id}`);

      // 1. Find existing student
      const student = await this.studentRepository.findById(id);
      if (!student) {
        throw new StudentNotFoundException(id);
      }

      // 2. Verify student belongs to the specified campus (if campusId provided)
      if (campusId && student.campusId !== campusId) {
        throw new NotFoundException(
          `Student with ID ${id} not found in this campus`,
        );
      }

      // 3. Block hard delete while retained historical records exist.
      const retainedHistoricalRecordCount =
        await this.studentHardDeleteGuard.countRetainedHistoricalRecords(
          id,
          campusId ?? student.campusId,
        );
      if (retainedHistoricalRecordCount > 0) {
        if (currentUser) {
          await this.transactionRunner.run(async (tx) => {
            await this.recorder.record(
              {
                actorId: currentUser.id,
                action: "BLOCK_STUDENT_HARD_DELETE_FOR_RETENTION",
                targetType: "student",
                targetId: id,
                campusId: campusId ?? student.campusId,
                context: {
                  actorName: currentUser.profile?.fullName ?? null,
                  retainedHistoricalRecordCount,
                  workflow: "historical_retention",
                },
              },
              tx,
            );
          });
        }
        throw new ConflictException({
          code: "STUDENT_HARD_DELETE_BLOCKED_BY_RETAINED_HISTORY",
          action: "USE_HISTORICAL_RETENTION_WORKFLOW",
          retainedHistoricalRecordCount,
          message:
            "Student hard delete is blocked while retained historical records exist.",
        });
      }

      // 4. Delete student
      await this.studentRepository.delete(id);

      this.logger.log(`Student deleted: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete student: ${error.message}`,
        error.stack,
      );
      if (error instanceof StudentNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
