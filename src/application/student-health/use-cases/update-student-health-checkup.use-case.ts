import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AuditEventRecorderPort, computeDiff } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  StudentHealthCheckup,
  UpdateStudentHealthCheckupData,
} from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthCheckupRepository } from "../ports";
import { pickStudentHealthCheckupAuditFields } from "./create-student-health-checkup.use-case";
import {
  assertStudentWritable,
  getStudentInCampusOrThrow,
} from "./student-health-student-scope";

export type UpdateStudentHealthCheckupInput = UpdateStudentHealthCheckupData;

const UPDATABLE_FIELDS = [
  "checkupType",
  "checkedAt",
  "heightCm",
  "weightKg",
  "notes",
] as const;

@Injectable()
export class UpdateStudentHealthCheckupUseCase {
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
    checkupId: string,
    input: UpdateStudentHealthCheckupInput,
    currentUser: User,
  ): Promise<StudentHealthCheckup> {
    assertPatchPayload(input);

    const student = await getStudentInCampusOrThrow(
      this.studentRepository,
      campusId,
      studentId,
    );
    assertStudentWritable(student);

    return this.transactionRunner.run(async (tx) => {
      const checkup = await this.checkupRepository.findByIdForStudentInCampus(
        campusId,
        studentId,
        checkupId,
      );
      if (!checkup) {
        throw new NotFoundException("Student health checkup not found");
      }

      const beforeAudit = pickStudentHealthCheckupAuditFields(checkup);
      try {
        checkup.update(input, currentUser.id);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }

      const requestedAfterAudit = pickStudentHealthCheckupAuditFields(checkup);
      const diff = computeDiff(beforeAudit, requestedAfterAudit);
      const saved = await this.checkupRepository.update(checkup, tx);

      await this.auditRecorder.record(
        {
          actorId: currentUser.id,
          action: "UPDATE_STUDENT_HEALTH_CHECKUP",
          targetType: "student_health_checkup",
          targetId: saved.id,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            studentId,
          },
          beforeValue: diff.before,
          afterValue: diff.after,
        },
        tx,
      );

      return saved;
    });
  }
}

function assertPatchPayload(
  input: UpdateStudentHealthCheckupInput,
): asserts input is UpdateStudentHealthCheckupInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new BadRequestException("Health checkup patch payload is required");
  }

  const keys = Object.keys(input);
  const unknownKeys = keys.filter(
    (key) =>
      !UPDATABLE_FIELDS.includes(key as (typeof UPDATABLE_FIELDS)[number]),
  );
  if (unknownKeys.length > 0) {
    throw new BadRequestException(
      `Unknown health checkup field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }

  const hasUpdate = UPDATABLE_FIELDS.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(input, field) &&
      input[field] !== undefined,
  );

  if (!hasUpdate) {
    throw new BadRequestException(
      "At least one health checkup field must be provided",
    );
  }
}
