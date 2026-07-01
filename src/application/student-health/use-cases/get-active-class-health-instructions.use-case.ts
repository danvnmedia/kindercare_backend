import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";

import { StudentHealthInstructionRepository } from "../ports";
import {
  ActiveStudentHealthInstructionItem,
  parseReferenceDate,
  toActiveInstructionItem,
} from "./get-active-student-health-instructions.use-case";

export interface ActiveClassHealthInstructionStudent {
  id: string;
  fullName: string;
  studentCode: string;
}

export interface ActiveClassHealthInstructionItem {
  student: ActiveClassHealthInstructionStudent;
  instructions: ActiveStudentHealthInstructionItem[];
}

export interface ActiveClassHealthInstructionsResponse {
  classId: string;
  campusId: string;
  date: string;
  items: ActiveClassHealthInstructionItem[];
}

export interface GetActiveClassHealthInstructionsInput {
  campusId: string;
  classId: string;
  date?: string;
}

@Injectable()
export class GetActiveClassHealthInstructionsUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_INSTRUCTION_REPOSITORY")
    private readonly instructionRepository: StudentHealthInstructionRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  async execute(
    input: GetActiveClassHealthInstructionsInput,
  ): Promise<ActiveClassHealthInstructionsResponse> {
    const referenceDate = parseReferenceDate(input.date);
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity || classEntity.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    const enrollments = (
      await this.enrollmentRepository.findHistoricalByClassId(input.classId)
    ).filter((enrollment) =>
      isEnrollmentActiveOnDate(enrollment, referenceDate),
    );
    const activeStudents = enrollments
      .map((enrollment) => enrollment.student)
      .filter((student): student is NonNullable<typeof student> => !!student)
      .filter((student) => student.campusId === input.campusId);
    const studentIds = activeStudents.map((student) => student.id);

    const instructions =
      await this.instructionRepository.findActiveByStudentsInCampus(
        input.campusId,
        studentIds,
        referenceDate,
      );

    const instructionsByStudent = new Map(
      studentIds.map(
        (studentId) =>
          [studentId, []] as [string, ActiveStudentHealthInstructionItem[]],
      ),
    );
    for (const instruction of instructions) {
      const group = instructionsByStudent.get(instruction.studentId);
      if (group) {
        group.push(toActiveInstructionItem(instruction));
      }
    }

    return {
      classId: input.classId,
      campusId: input.campusId,
      date: referenceDate.toISOString().slice(0, 10),
      items: activeStudents.map((student) => ({
        student: {
          id: student.id,
          fullName: student.fullName,
          studentCode: student.studentCode,
        },
        instructions: instructionsByStudent.get(student.id) ?? [],
      })),
    };
  }
}

function isEnrollmentActiveOnDate(
  enrollment: Enrollment,
  referenceDate: Date,
): boolean {
  const reference = toDateOnly(referenceDate).getTime();
  const start = toDateOnly(enrollment.enrollmentDate).getTime();
  const end = enrollment.endDate
    ? toDateOnly(enrollment.endDate).getTime()
    : null;

  return start <= reference && (end === null || end >= reference);
}

function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
