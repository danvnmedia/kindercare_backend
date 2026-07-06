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
  StudentHealthEvent,
  UpdateStudentHealthEventData,
} from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthEventRepository } from "../ports";
import { pickStudentHealthEventAuditFields } from "./create-student-health-event.use-case";
import {
  assertStudentWritable,
  getStudentInCampusOrThrow,
} from "./student-health-student-scope";

export type UpdateStudentHealthEventInput = UpdateStudentHealthEventData;

const UPDATABLE_FIELDS = [
  "eventType",
  "category",
  "title",
  "description",
  "occurredAt",
  "status",
  "resolutionNotes",
] as const;

@Injectable()
export class UpdateStudentHealthEventUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_EVENT_REPOSITORY")
    private readonly eventRepository: StudentHealthEventRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {}

  async execute(
    campusId: string,
    studentId: string,
    eventId: string,
    input: UpdateStudentHealthEventInput,
    currentUser: User,
  ): Promise<StudentHealthEvent> {
    assertPatchPayload(input);

    const student = await getStudentInCampusOrThrow(
      this.studentRepository,
      campusId,
      studentId,
    );
    assertStudentWritable(student);

    return this.transactionRunner.run(async (tx) => {
      const event = await this.eventRepository.findByIdForStudentInCampus(
        campusId,
        studentId,
        eventId,
      );
      if (!event) {
        throw new NotFoundException("Student health event not found");
      }

      const beforeAudit = pickStudentHealthEventAuditFields(event);
      try {
        event.update(input, currentUser.id);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }

      const requestedAfterAudit = pickStudentHealthEventAuditFields(event);
      const diff = computeDiff(beforeAudit, requestedAfterAudit);
      const saved = await this.eventRepository.update(event, tx);

      await this.auditRecorder.record(
        {
          actorId: currentUser.id,
          action: "UPDATE_STUDENT_HEALTH_EVENT",
          targetType: "student_health_event",
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
  input: UpdateStudentHealthEventInput,
): asserts input is UpdateStudentHealthEventInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new BadRequestException("Health event patch payload is required");
  }

  const keys = Object.keys(input);
  const unknownKeys = keys.filter(
    (key) =>
      !UPDATABLE_FIELDS.includes(key as (typeof UPDATABLE_FIELDS)[number]),
  );
  if (unknownKeys.length > 0) {
    throw new BadRequestException(
      `Unknown health event field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }

  const hasUpdate = UPDATABLE_FIELDS.some(
    (field) =>
      Object.prototype.hasOwnProperty.call(input, field) &&
      input[field] !== undefined,
  );

  if (!hasUpdate) {
    throw new BadRequestException(
      "At least one health event field must be provided",
    );
  }
}
