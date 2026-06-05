import { BadRequestException, NotFoundException } from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import {
  MEAL_MENU_TARGET_TYPES,
  MealMenuClassSnapshot,
  MealMenuGradeLevelSnapshot,
  MealMenuTargetType,
} from "@/domain/meal-menu";

export interface MealMenuWriteTargetInput {
  targetType?: MealMenuTargetType;
  gradeLevelId?: string | null;
  classId?: string | null;
}

export interface ResolvedMealMenuWriteTarget {
  targetType: MealMenuTargetType;
  gradeLevelId: string | null;
  classId: string | null;
  gradeLevel: MealMenuGradeLevelSnapshot | null;
  classroom: MealMenuClassSnapshot | null;
}

export interface ResolveMealMenuWriteTargetOptions
  extends MealMenuWriteTargetInput {
  campusId: string;
  gradeLevelRepository: GradeLevelRepository;
  classRepository: ClassRepository;
}

export async function resolveMealMenuWriteTarget(
  options: ResolveMealMenuWriteTargetOptions,
): Promise<ResolvedMealMenuWriteTarget> {
  const { targetType } = options;

  if (targetType === undefined) {
    throw new BadRequestException("targetType is required");
  }

  if (!MEAL_MENU_TARGET_TYPES.includes(targetType)) {
    throw new BadRequestException(
      "targetType must be one of: campus, grade, class",
    );
  }

  switch (targetType) {
    case "campus":
      return resolveCampusTarget(options);
    case "grade":
      return resolveGradeTarget(options);
    case "class":
      return resolveClassTarget(options);
  }
}

function resolveCampusTarget(
  input: ResolveMealMenuWriteTargetOptions,
): ResolvedMealMenuWriteTarget {
  if (input.gradeLevelId !== undefined || input.classId !== undefined) {
    throw new BadRequestException(
      "Campus meal menu targets must not include gradeLevelId or classId",
    );
  }

  return {
    targetType: "campus",
    gradeLevelId: null,
    classId: null,
    gradeLevel: null,
    classroom: null,
  };
}

async function resolveGradeTarget(
  input: ResolveMealMenuWriteTargetOptions,
): Promise<ResolvedMealMenuWriteTarget> {
  if (input.classId !== undefined) {
    throw new BadRequestException(
      "Grade meal menu targets must not include classId",
    );
  }

  if (input.gradeLevelId === undefined || input.gradeLevelId === null) {
    throw new BadRequestException(
      "gradeLevelId is required for grade meal menu targets",
    );
  }

  const gradeLevel = await input.gradeLevelRepository.findById(
    input.gradeLevelId,
  );
  if (!gradeLevel || gradeLevel.campusId !== input.campusId) {
    throw new NotFoundException(
      `Grade level with ID ${input.gradeLevelId} not found`,
    );
  }

  return {
    targetType: "grade",
    gradeLevelId: gradeLevel.id,
    classId: null,
    gradeLevel: {
      id: gradeLevel.id,
      name: gradeLevel.name,
    },
    classroom: null,
  };
}

async function resolveClassTarget(
  input: ResolveMealMenuWriteTargetOptions,
): Promise<ResolvedMealMenuWriteTarget> {
  if (input.gradeLevelId !== undefined) {
    throw new BadRequestException(
      "Class meal menu targets must not include gradeLevelId",
    );
  }

  if (input.classId === undefined || input.classId === null) {
    throw new BadRequestException(
      "classId is required for class meal menu targets",
    );
  }

  const classroom = await input.classRepository.findById(input.classId);
  if (!classroom || classroom.campusId !== input.campusId) {
    throw new NotFoundException(`Class with ID ${input.classId} not found`);
  }

  return {
    targetType: "class",
    gradeLevelId: null,
    classId: classroom.id,
    gradeLevel: null,
    classroom: {
      id: classroom.id,
      name: classroom.name,
      gradeLevelId: classroom.gradeLevelId,
    },
  };
}
