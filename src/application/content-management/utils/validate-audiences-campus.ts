import { BadRequestException } from "@nestjs/common";
import { AudienceType } from "@/domain/content-management";
import { ClassRepository } from "@/application/class-management/ports/class.repository";

export interface AudienceInput {
  audienceType: AudienceType;
  audienceId?: string; // Optional for ALL type
}

export interface AudienceValidationDependencies {
  classRepository: ClassRepository;
}

export function assertValidPostAudiences(
  audiences: unknown,
): asserts audiences is AudienceInput[] {
  if (!Array.isArray(audiences) || audiences.length === 0) {
    throw new BadRequestException("Post must have at least one audience");
  }

  const allAudiences = audiences.filter(
    (audience): audience is AudienceInput =>
      !!audience &&
      typeof audience === "object" &&
      audience.audienceType === AudienceType.ALL,
  );
  if (allAudiences.length > 0 && audiences.length !== 1) {
    throw new BadRequestException(
      "School-wide audience cannot be combined with class audiences",
    );
  }

  const classIds = new Set<string>();
  for (const audience of audiences) {
    if (!audience || typeof audience !== "object") {
      throw new BadRequestException("Invalid post audience");
    }

    switch (audience.audienceType) {
      case AudienceType.ALL:
        break;
      case AudienceType.CLASS:
        if (!audience.audienceId) {
          throw new BadRequestException(
            "audienceId is required for CLASS audience type",
          );
        }
        if (classIds.has(audience.audienceId)) {
          throw new BadRequestException(
            "Post audiences must not contain duplicates",
          );
        }
        classIds.add(audience.audienceId);
        break;
      default:
        throw new BadRequestException("Unsupported post audience type");
    }
  }
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
 * Validates that all audience targets (Class) belong to the specified campus.
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
  assertValidPostAudiences(audiences);

  const classIds = new Set<string>();

  // Collect IDs by type
  for (const audience of audiences) {
    switch (audience.audienceType) {
      case AudienceType.CLASS:
        if (audience.audienceId) {
          classIds.add(audience.audienceId);
        }
        break;

      case AudienceType.ALL:
        // ALL audience type doesn't have a specific target, skip validation
        break;
    }
  }

  const uniqueClassIds = [...classIds];

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
}
