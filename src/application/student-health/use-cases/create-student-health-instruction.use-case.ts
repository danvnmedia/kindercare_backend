import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthInstruction } from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { StudentHealthInstructionRepository } from "../ports";
import {
  assertStudentWritable,
  getStudentInCampusOrThrow,
} from "./student-health-student-scope";

export interface CreateStudentHealthInstructionInput {
  instructionType?: unknown;
  title?: unknown;
  instruction?: unknown;
  dosage?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  timesOfDay?: unknown;
  scheduleNotes?: unknown;
  notes?: unknown;
  isActive?: unknown;
}

@Injectable()
export class CreateStudentHealthInstructionUseCase {
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
    input: CreateStudentHealthInstructionInput,
    currentUser: User,
  ): Promise<StudentHealthInstruction> {
    const instruction = this.createEntity(
      campusId,
      studentId,
      input,
      currentUser,
    );
    const student = await getStudentInCampusOrThrow(
      this.studentRepository,
      campusId,
      studentId,
    );
    assertStudentWritable(student);

    return this.transactionRunner.run(async (tx) => {
      const saved = await this.instructionRepository.create(instruction, tx);

      await this.auditRecorder.record(
        {
          actorId: currentUser.id,
          action: "CREATE_STUDENT_HEALTH_INSTRUCTION",
          targetType: "student_health_instruction",
          targetId: saved.id,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            studentId,
          },
          beforeValue: null,
          afterValue: pickStudentHealthInstructionAuditFields(saved),
        },
        tx,
      );

      return saved;
    });
  }

  private createEntity(
    campusId: string,
    studentId: string,
    input: CreateStudentHealthInstructionInput,
    currentUser: User,
  ): StudentHealthInstruction {
    if (!currentUser.id) {
      throw new BadRequestException("Actor user ID is required");
    }

    try {
      return StudentHealthInstruction.create({
        ...input,
        campusId,
        studentId,
        createdByUserId: currentUser.id,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}

export function pickStudentHealthInstructionAuditFields(
  instruction: StudentHealthInstruction,
) {
  return {
    instructionType: instruction.instructionType,
    title: instruction.title,
    instruction: instruction.instruction,
    dosage: instruction.dosage,
    startDate: instruction.startDate.toISOString().slice(0, 10),
    endDate: instruction.endDate?.toISOString().slice(0, 10) ?? null,
    timesOfDay: instruction.timesOfDay,
    scheduleNotes: instruction.scheduleNotes,
    notes: instruction.notes,
    isActive: instruction.isActive,
  };
}
