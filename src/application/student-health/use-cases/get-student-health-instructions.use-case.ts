import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  StudentHealthInstruction,
  StudentHealthInstructionStatus,
  normalizeReferenceDate,
} from "@/domain/student-health";

import {
  StudentHealthInstructionListParams,
  StudentHealthInstructionRepository,
} from "../ports";
import { getStudentInCampusOrThrow } from "./student-health-student-scope";

export interface GetStudentHealthInstructionsInput {
  campusId: string;
  studentId: string;
  params: StudentHealthInstructionListParams;
}

@Injectable()
export class GetStudentHealthInstructionsUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_INSTRUCTION_REPOSITORY")
    private readonly instructionRepository: StudentHealthInstructionRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentHealthInstructionsInput,
  ): Promise<PaginatedResult<StudentHealthInstruction>> {
    const params = normalizeInstructionListParams(input.params);
    await getStudentInCampusOrThrow(
      this.studentRepository,
      input.campusId,
      input.studentId,
    );

    return this.instructionRepository.findByStudentInCampus(
      input.campusId,
      input.studentId,
      params,
    );
  }
}

export function normalizeInstructionListParams(
  params: StudentHealthInstructionListParams,
): StudentHealthInstructionListParams {
  if (params.status !== undefined) {
    const allowedValues = Object.values(StudentHealthInstructionStatus);
    if (!allowedValues.includes(params.status)) {
      throw new BadRequestException(
        `Status must be one of: ${allowedValues.join(", ")}`,
      );
    }
  }

  if (params.date !== undefined) {
    try {
      normalizeReferenceDate(params.date);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  return params;
}
