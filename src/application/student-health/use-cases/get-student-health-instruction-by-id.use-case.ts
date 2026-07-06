import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthInstruction } from "@/domain/student-health";

import { StudentHealthInstructionRepository } from "../ports";
import { getStudentInCampusOrThrow } from "./student-health-student-scope";

export interface GetStudentHealthInstructionByIdInput {
  campusId: string;
  studentId: string;
  instructionId: string;
}

@Injectable()
export class GetStudentHealthInstructionByIdUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_INSTRUCTION_REPOSITORY")
    private readonly instructionRepository: StudentHealthInstructionRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentHealthInstructionByIdInput,
  ): Promise<StudentHealthInstruction> {
    await getStudentInCampusOrThrow(
      this.studentRepository,
      input.campusId,
      input.studentId,
    );

    const instruction =
      await this.instructionRepository.findByIdForStudentInCampus(
        input.campusId,
        input.studentId,
        input.instructionId,
      );
    if (!instruction) {
      throw new NotFoundException("Student health instruction not found");
    }

    return instruction;
  }
}
