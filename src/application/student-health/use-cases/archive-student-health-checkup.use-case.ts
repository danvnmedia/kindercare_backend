import { Inject, Injectable } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthCheckup } from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthCheckupRepository } from "../ports";
import { archiveStudentHealthRecord } from "./archive-student-health-record";

@Injectable()
export class ArchiveStudentHealthCheckupUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_CHECKUP_REPOSITORY")
    private readonly checkupRepository: StudentHealthCheckupRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {}

  execute(
    campusId: string,
    studentId: string,
    checkupId: string,
    currentUser: User,
    now = new Date(),
  ): Promise<StudentHealthCheckup> {
    return archiveStudentHealthRecord({
      campusId,
      studentId,
      recordId: checkupId,
      currentUser,
      now,
      repository: this.checkupRepository,
      studentRepository: this.studentRepository,
      transactionRunner: this.transactionRunner,
      auditRecorder: this.auditRecorder,
      auditAction: "ARCHIVE_STUDENT_HEALTH_CHECKUP",
      auditTargetType: "student_health_checkup",
      notFoundMessage: "Student health checkup not found",
    });
  }
}
