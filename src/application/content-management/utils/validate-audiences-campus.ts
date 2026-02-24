import { BadRequestException } from "@nestjs/common";
import { AudienceType } from "@/domain/content-management";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

export interface AudienceInput {
  audienceType: AudienceType;
  audienceId?: string; // Optional for ALL type
}

export interface AudienceValidationDependencies {
  classRepository: ClassRepository;
  gradeLevelRepository: GradeLevelRepository;
  studentRepository: StudentRepository;
}

interface CampusScopedEntity {
  id: string;
  campusId: string;
}

function ensureEntitiesExistAndBelongToCampus<T extends CampusScopedEntity>(
  ids: string[],
  entities: T[],
  campusId: string,
  notFoundLabel: string,
  campusMismatchMessage: (entity: T) => string,
): void {
  const foundIds = new Set(entities.map((entity) => entity.id));
  for (const id of ids) {
    if (!foundIds.has(id)) {
      throw new BadRequestException(`${notFoundLabel} with ID ${id} not found`);
    }
  }

  for (const entity of entities) {
    if (entity.campusId !== campusId) {
      throw new BadRequestException(campusMismatchMessage(entity));
    }
  }
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

  const classIds = new Set<string>();
  const gradeIds = new Set<string>();
  const studentIds = new Set<string>();

  // Collect IDs by type
  for (const audience of audiences) {
    switch (audience.audienceType) {
      case AudienceType.CLASS:
        if (audience.audienceId) {
          classIds.add(audience.audienceId);
        }
        break;
      case AudienceType.GRADE:
        if (audience.audienceId) {
          gradeIds.add(audience.audienceId);
        }
        break;
      case AudienceType.STUDENT:
        if (audience.audienceId) {
          studentIds.add(audience.audienceId);
        }
        break;
      case AudienceType.ALL:
        // ALL audience type doesn't have a specific target, skip validation
        break;
    }
  }

  const uniqueClassIds = [...classIds];
  const uniqueGradeIds = [...gradeIds];
  const uniqueStudentIds = [...studentIds];

  // Validate classes belong to campus
  if (uniqueClassIds.length > 0) {
    const classes = await deps.classRepository.findByIds(uniqueClassIds);
    ensureEntitiesExistAndBelongToCampus(
      uniqueClassIds,
      classes,
      campusId,
      "Class",
      (classEntity) =>
        `Class "${classEntity.name}" does not belong to the specified campus`,
    );
  }

  // Validate grade levels belong to campus
  if (uniqueGradeIds.length > 0) {
    const gradeLevels = await Promise.all(
      uniqueGradeIds.map((gradeId) =>
        deps.gradeLevelRepository.findById(gradeId),
      ),
    );
    const existingGradeLevels = gradeLevels.filter(
      (gradeLevel): gradeLevel is NonNullable<typeof gradeLevel> =>
        gradeLevel !== null,
    );

    ensureEntitiesExistAndBelongToCampus(
      uniqueGradeIds,
      existingGradeLevels,
      campusId,
      "Grade level",
      (gradeLevel) =>
        `Grade level "${gradeLevel.name}" does not belong to the specified campus`,
    );
  }

  // Validate students belong to campus
  if (uniqueStudentIds.length > 0) {
    const students = await deps.studentRepository.findByIds(uniqueStudentIds);
    ensureEntitiesExistAndBelongToCampus(
      uniqueStudentIds,
      students,
      campusId,
      "Student",
      (student) =>
        `Student "${student.fullName}" does not belong to the specified campus`,
    );
  }
}
