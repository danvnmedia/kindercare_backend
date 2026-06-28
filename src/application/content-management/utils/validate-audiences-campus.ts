import { BadRequestException } from "@nestjs/common";
import { AudienceType } from "@/domain/content-management";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

export interface AudienceInput {
  audienceType: AudienceType;
  audienceId: string;
}

export interface AudienceValidationDependencies {
  classRepository: ClassRepository;
  gradeLevelRepository: GradeLevelRepository;
  studentRepository: StudentRepository;
}

/**
 * Validates that all audience targets (Class, GradeLevel, Student) belong to the specified campus.
 * Throws BadRequestException if any target is from a different campus or doesn't exist.
 *
 * @param audiences - Array of audience inputs to validate
 * @param campusId - Campus ID the audiences must belong to
 * @param deps - Repository dependencies for validation
 */
export async function validateAudiencesBelongToCampus(
  audiences: AudienceInput[],
  campusId: string,
  deps: AudienceValidationDependencies,
): Promise<void> {
  if (!audiences || audiences.length === 0) {
    return;
  }

  const classIds: string[] = [];
  const gradeIds: string[] = [];
  const studentIds: string[] = [];

  // Collect IDs by type
  for (const audience of audiences) {
    switch (audience.audienceType) {
      case AudienceType.CLASS:
        classIds.push(audience.audienceId);
        break;
      case AudienceType.GRADE:
        gradeIds.push(audience.audienceId);
        break;
      case AudienceType.STUDENT:
        studentIds.push(audience.audienceId);
        break;
      case AudienceType.ALL:
        // ALL audience type doesn't have a specific target, skip validation
        break;
    }
  }

  // Validate classes belong to campus
  if (classIds.length > 0) {
    const classes = await deps.classRepository.findByIds(classIds);

    // Check if all classes were found
    const foundIds = new Set(classes.map((c) => c.id.toString()));
    for (const id of classIds) {
      if (!foundIds.has(id)) {
        throw new BadRequestException(`Class with ID ${id} not found`);
      }
    }

    // Check if all classes belong to the campus
    for (const classEntity of classes) {
      if (classEntity.campusId !== campusId) {
        throw new BadRequestException(
          `Class "${classEntity.name}" does not belong to the specified campus`,
        );
      }
    }
  }

  // Validate grade levels belong to campus
  if (gradeIds.length > 0) {
    for (const gradeId of gradeIds) {
      const gradeLevel = await deps.gradeLevelRepository.findById(gradeId);

      if (!gradeLevel) {
        throw new BadRequestException(
          `Grade level with ID ${gradeId} not found`,
        );
      }

      if (gradeLevel.campusId !== campusId) {
        throw new BadRequestException(
          `Grade level "${gradeLevel.name}" does not belong to the specified campus`,
        );
      }
    }
  }

  // Validate students belong to campus
  if (studentIds.length > 0) {
    const students = await deps.studentRepository.findByIds(studentIds);

    // Check if all students were found
    const foundIds = new Set(students.map((s) => s.id.toString()));
    for (const id of studentIds) {
      if (!foundIds.has(id)) {
        throw new BadRequestException(`Student with ID ${id} not found`);
      }
    }

    // Check if all students belong to the campus
    for (const student of students) {
      if (student.campusId !== campusId) {
        throw new BadRequestException(
          `Student "${student.fullName}" does not belong to the specified campus`,
        );
      }
    }
  }
}
