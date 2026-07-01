import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { StudentHealthCheckup } from "@/domain/student-health";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

import { StudentHealthCheckupRepository } from "../ports";
import { getStudentInCampusOrThrow } from "./student-health-student-scope";

export interface GetStudentHealthCheckupByIdInput {
  campusId: string;
  studentId: string;
  checkupId: string;
}

@Injectable()
export class GetStudentHealthCheckupByIdUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_CHECKUP_REPOSITORY")
    private readonly checkupRepository: StudentHealthCheckupRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentHealthCheckupByIdInput,
  ): Promise<StudentHealthCheckup> {
    await getStudentInCampusOrThrow(
      this.studentRepository,
      input.campusId,
      input.studentId,
    );

    const checkup = await this.checkupRepository.findByIdForStudentInCampus(
      input.campusId,
      input.studentId,
      input.checkupId,
    );
    if (!checkup) {
      throw new NotFoundException("Student health checkup not found");
    }

    return checkup;
  }
}
