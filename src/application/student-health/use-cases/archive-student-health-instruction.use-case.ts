import { Inject, Injectable } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthInstruction } from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthInstructionRepository } from "../ports";
import { archiveStudentHealthRecord } from "./archive-student-health-record";

@Injectable()
export class ArchiveStudentHealthInstructionUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_INSTRUCTION_REPOSITORY")
    private readonly instructionRepository: StudentHealthInstructionRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {}

  execute(
    campusId: string,
    studentId: string,
    instructionId: string,
    currentUser: User,
    now = new Date(),
  ): Promise<StudentHealthInstruction> {
    return archiveStudentHealthRecord({
      campusId,
      studentId,
      recordId: instructionId,
      currentUser,
      now,
      repository: this.instructionRepository,
      studentRepository: this.studentRepository,
      transactionRunner: this.transactionRunner,
      auditRecorder: this.auditRecorder,
      auditAction: "ARCHIVE_STUDENT_HEALTH_INSTRUCTION",
      auditTargetType: "student_health_instruction",
      notFoundMessage: "Student health instruction not found",
    });
  }
}
