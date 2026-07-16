import { Inject, Injectable } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthEvent } from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthEventRepository } from "../ports";
import { archiveStudentHealthRecord } from "./archive-student-health-record";

@Injectable()
export class ArchiveStudentHealthEventUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_EVENT_REPOSITORY")
    private readonly eventRepository: StudentHealthEventRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {}

  execute(
    campusId: string,
    studentId: string,
    eventId: string,
    currentUser: User,
    now = new Date(),
  ): Promise<StudentHealthEvent> {
    return archiveStudentHealthRecord({
      campusId,
      studentId,
      recordId: eventId,
      currentUser,
      now,
      repository: this.eventRepository,
      studentRepository: this.studentRepository,
      transactionRunner: this.transactionRunner,
      auditRecorder: this.auditRecorder,
      auditAction: "ARCHIVE_STUDENT_HEALTH_EVENT",
      auditTargetType: "student_health_event",
      notFoundMessage: "Student health event not found",
    });
  }
}
