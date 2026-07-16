import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AuditEventRecorderPort, computeDiff } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  StudentHealthInstruction,
  UpdateStudentHealthInstructionData,
} from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthInstructionRepository } from "../ports";
import { pickStudentHealthInstructionAuditFields } from "./create-student-health-instruction.use-case";
import {
  assertStudentWritable,
  getStudentInCampusOrThrow,
} from "./student-health-student-scope";

export type UpdateStudentHealthInstructionInput =
  UpdateStudentHealthInstructionData;

const UPDATABLE_FIELDS = [
  "instructionType",
  "title",
  "instruction",
  "dosage",
  "startDate",
  "endDate",
  "timesOfDay",
  "scheduleNotes",
  "notes",
  "isActive",
] as const;

@Injectable()
export class UpdateStudentHealthInstructionUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_INSTRUCTION_REPOSITORY")
    private readonly instructionRepository: StudentHealthInstructionRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {}

  async execute(
    campusId: string,
    studentId: string,
    instructionId: string,
    input: UpdateStudentHealthInstructionInput,
    currentUser: User,
  ): Promise<StudentHealthInstruction> {
    assertPatchPayload(input);

    const student = await getStudentInCampusOrThrow(
      this.studentRepository,
      campusId,
      studentId,
    );
    assertStudentWritable(student);

    return this.transactionRunner.run(async (tx) => {
      const instruction =
        await this.instructionRepository.findByIdForStudentInCampus(
          campusId,
          studentId,
          instructionId,
          tx,
        );
      if (!instruction) {
        throw new NotFoundException("Student health instruction not found");
      }
      if (instruction.isArchived) {
        throw new ConflictException(
          "Archived health instructions cannot be updated",
        );
      }

      const beforeAudit = pickStudentHealthInstructionAuditFields(instruction);
      try {
        instruction.update(input, currentUser.id);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }

      const requestedAfterAudit =
        pickStudentHealthInstructionAuditFields(instruction);
      const diff = computeDiff(beforeAudit, requestedAfterAudit);
      const saved = await this.instructionRepository.updateIfActive(
        instruction,
        tx,
      );
      if (!saved) {
        throw new ConflictException(
          "Health instruction was archived while the update was in progress",
        );
      }

      await this.auditRecorder.record(
        {
          actorId: currentUser.id,
          action: "UPDATE_STUDENT_HEALTH_INSTRUCTION",
          targetType: "student_health_instruction",
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
  input: UpdateStudentHealthInstructionInput,
): asserts input is UpdateStudentHealthInstructionInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new BadRequestException(
      "Health instruction patch payload is required",
    );
  }

  const keys = Object.keys(input);
  const unknownKeys = keys.filter(
    (key) =>
      !UPDATABLE_FIELDS.includes(key as (typeof UPDATABLE_FIELDS)[number]),
  );
  if (unknownKeys.length > 0) {
    throw new BadRequestException(
      `Unknown health instruction field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }

  const hasUpdate = UPDATABLE_FIELDS.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(input, field) &&
      input[field] !== undefined,
  );

  if (!hasUpdate) {
    throw new BadRequestException(
      "At least one health instruction field must be provided",
    );
  }
}
