import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthEvent } from "@/domain/student-health";

import { StudentHealthEventRepository } from "../ports";
import { getStudentInCampusOrThrow } from "./student-health-student-scope";

export interface GetStudentHealthEventByIdInput {
  campusId: string;
  studentId: string;
  eventId: string;
}

@Injectable()
export class GetStudentHealthEventByIdUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_EVENT_REPOSITORY")
    private readonly eventRepository: StudentHealthEventRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentHealthEventByIdInput,
  ): Promise<StudentHealthEvent> {
    await getStudentInCampusOrThrow(
      this.studentRepository,
      input.campusId,
      input.studentId,
    );

    const event = await this.eventRepository.findByIdForStudentInCampus(
      input.campusId,
      input.studentId,
      input.eventId,
    );
    if (!event) {
      throw new NotFoundException("Student health event not found");
    }

    return event;
  }
}
