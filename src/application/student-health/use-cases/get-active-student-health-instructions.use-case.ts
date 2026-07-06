import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  StudentHealthInstruction,
  normalizeReferenceDate,
} from "@/domain/student-health";

import { StudentHealthInstructionRepository } from "../ports";
import { getStudentInCampusOrThrow } from "./student-health-student-scope";

export interface ActiveStudentHealthInstructionItem {
  id: string;
  instructionType: StudentHealthInstruction["instructionType"];
  title: string;
  instruction: string;
  dosage: string | null;
  timesOfDay: string[];
  scheduleNotes: string | null;
  status: "ACTIVE";
}

export interface ActiveStudentHealthInstructionsResponse {
  studentId: string;
  campusId: string;
  date: string;
  instructions: ActiveStudentHealthInstructionItem[];
}

export interface GetActiveStudentHealthInstructionsInput {
  campusId: string;
  studentId: string;
  date?: string;
}

@Injectable()
export class GetActiveStudentHealthInstructionsUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_INSTRUCTION_REPOSITORY")
    private readonly instructionRepository: StudentHealthInstructionRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetActiveStudentHealthInstructionsInput,
  ): Promise<ActiveStudentHealthInstructionsResponse> {
    const referenceDate = parseReferenceDate(input.date);
    await getStudentInCampusOrThrow(
      this.studentRepository,
      input.campusId,
      input.studentId,
    );

    const instructions =
      await this.instructionRepository.findActiveByStudentInCampus(
        input.campusId,
        input.studentId,
        referenceDate,
      );

    return {
      studentId: input.studentId,
      campusId: input.campusId,
      date: referenceDate.toISOString().slice(0, 10),
      instructions: instructions.map(toActiveInstructionItem),
    };
  }
}

export function parseReferenceDate(value?: string): Date {
  try {
    return normalizeReferenceDate(value ?? new Date());
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}

export function toActiveInstructionItem(
  instruction: StudentHealthInstruction,
): ActiveStudentHealthInstructionItem {
  return {
    id: instruction.id,
    instructionType: instruction.instructionType,
    title: instruction.title,
    instruction: instruction.instruction,
    dosage: instruction.dosage,
    timesOfDay: instruction.timesOfDay,
    scheduleNotes: instruction.scheduleNotes,
    status: "ACTIVE",
  };
}
