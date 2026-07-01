import { Inject, Injectable } from "@nestjs/common";

import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { StudentHealthProfile } from "@/domain/student-health";

import { StudentHealthProfileRepository } from "../ports";
import { getStudentInCampusOrThrow } from "./student-health-student-scope";

export interface GetStudentHealthProfileInput {
  campusId: string;
  studentId: string;
}

@Injectable()
export class GetStudentHealthProfileUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_PROFILE_REPOSITORY")
    private readonly profileRepository: StudentHealthProfileRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentHealthProfileInput,
  ): Promise<StudentHealthProfile> {
    await getStudentInCampusOrThrow(
      this.studentRepository,
      input.campusId,
      input.studentId,
    );

    return this.profileRepository.getOrCreateEmpty(
      input.campusId,
      input.studentId,
    );
  }
}
