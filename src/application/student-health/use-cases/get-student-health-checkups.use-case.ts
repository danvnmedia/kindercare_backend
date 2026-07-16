import { Inject, Injectable } from "@nestjs/common";

import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StudentHealthCheckup } from "@/domain/student-health";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

import {
  StudentHealthCheckupListParams,
  StudentHealthCheckupRepository,
} from "../ports";
import { getStudentInCampusOrThrow } from "./student-health-student-scope";

export interface GetStudentHealthCheckupsInput {
  campusId: string;
  studentId: string;
  params: StudentHealthCheckupListParams;
}

@Injectable()
export class GetStudentHealthCheckupsUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_CHECKUP_REPOSITORY")
    private readonly checkupRepository: StudentHealthCheckupRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentHealthCheckupsInput,
  ): Promise<PaginatedResult<StudentHealthCheckup>> {
    await getStudentInCampusOrThrow(
      this.studentRepository,
      input.campusId,
      input.studentId,
    );

    return this.checkupRepository.findByStudentInCampus(
      input.campusId,
      input.studentId,
      input.params,
    );
  }
}
