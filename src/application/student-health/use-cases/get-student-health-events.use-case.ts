import { Inject, Injectable } from "@nestjs/common";

import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StudentHealthEvent } from "@/domain/student-health";

import {
  StudentHealthEventListParams,
  StudentHealthEventRepository,
} from "../ports";
import { getStudentInCampusOrThrow } from "./student-health-student-scope";

export interface GetStudentHealthEventsInput {
  campusId: string;
  studentId: string;
  params: StudentHealthEventListParams;
}

@Injectable()
export class GetStudentHealthEventsUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_EVENT_REPOSITORY")
    private readonly eventRepository: StudentHealthEventRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentHealthEventsInput,
  ): Promise<PaginatedResult<StudentHealthEvent>> {
    await getStudentInCampusOrThrow(
      this.studentRepository,
      input.campusId,
      input.studentId,
    );

    return this.eventRepository.findByStudentInCampus(
      input.campusId,
      input.studentId,
      input.params,
    );
  }
}
