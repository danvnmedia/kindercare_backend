import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthCheckup } from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthCheckupRepository } from "../ports";
import {
  assertStudentWritable,
  getStudentInCampusOrThrow,
} from "./student-health-student-scope";

export interface CreateStudentHealthCheckupInput {
  checkupType?: unknown;
  checkedAt?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  notes?: unknown;
}

@Injectable()
export class CreateStudentHealthCheckupUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_CHECKUP_REPOSITORY")
    private readonly checkupRepository: StudentHealthCheckupRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {}

  async execute(
    campusId: string,
    studentId: string,
    input: CreateStudentHealthCheckupInput,
    currentUser: User,
  ): Promise<StudentHealthCheckup> {
    const checkup = this.createEntity(campusId, studentId, input, currentUser);
    const student = await getStudentInCampusOrThrow(
      this.studentRepository,
      campusId,
      studentId,
    );
    assertStudentWritable(student);

    return this.transactionRunner.run(async (tx) => {
      const saved = await this.checkupRepository.create(checkup, tx);

      await this.auditRecorder.record(
        {
          actorId: currentUser.id,
          action: "CREATE_STUDENT_HEALTH_CHECKUP",
          targetType: "student_health_checkup",
          targetId: saved.id,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            studentId,
          },
          beforeValue: null,
          afterValue: pickStudentHealthCheckupAuditFields(saved),
        },
        tx,
      );

      return saved;
    });
  }

  private createEntity(
    campusId: string,
    studentId: string,
    input: CreateStudentHealthCheckupInput,
    currentUser: User,
  ): StudentHealthCheckup {
    if (!currentUser.id) {
      throw new BadRequestException("Actor user ID is required");
    }

    try {
      return StudentHealthCheckup.create({
        ...input,
        campusId,
        studentId,
        recordedByUserId: currentUser.id,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}

export function pickStudentHealthCheckupAuditFields(
  checkup: StudentHealthCheckup,
) {
  return {
    checkupType: checkup.checkupType,
    checkedAt: checkup.checkedAt.toISOString(),
    heightCm: checkup.heightCm,
    weightKg: checkup.weightKg,
    notes: checkup.notes,
  };
}
