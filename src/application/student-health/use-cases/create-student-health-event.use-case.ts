import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthEvent } from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthEventRepository } from "../ports";
import {
  assertStudentWritable,
  getStudentInCampusOrThrow,
} from "./student-health-student-scope";

export interface CreateStudentHealthEventInput {
  eventType?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  occurredAt?: unknown;
  status?: unknown;
  resolutionNotes?: unknown;
}

@Injectable()
export class CreateStudentHealthEventUseCase {
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
    input: CreateStudentHealthEventInput,
    currentUser: User,
  ): Promise<StudentHealthEvent> {
    const event = this.createEntity(campusId, studentId, input, currentUser);
    const student = await getStudentInCampusOrThrow(
      this.studentRepository,
      campusId,
      studentId,
    );
    assertStudentWritable(student);

    return this.transactionRunner.run(async (tx) => {
      const saved = await this.eventRepository.create(event, tx);

      await this.auditRecorder.record(
        {
          actorId: currentUser.id,
          action: "CREATE_STUDENT_HEALTH_EVENT",
          targetType: "student_health_event",
          targetId: saved.id,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            studentId,
          },
          beforeValue: null,
          afterValue: pickStudentHealthEventAuditFields(saved),
        },
        tx,
      );

      return saved;
    });
  }

  private createEntity(
    campusId: string,
    studentId: string,
    input: CreateStudentHealthEventInput,
    currentUser: User,
  ): StudentHealthEvent {
    if (!currentUser.id) {
      throw new BadRequestException("Actor user ID is required");
    }

    try {
      return StudentHealthEvent.create({
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

export function pickStudentHealthEventAuditFields(event: StudentHealthEvent) {
  return {
    eventType: event.eventType,
    category: event.category,
    title: event.title,
    description: event.description,
    occurredAt: event.occurredAt.toISOString(),
    status: event.status,
    resolutionNotes: event.resolutionNotes,
  };
}
