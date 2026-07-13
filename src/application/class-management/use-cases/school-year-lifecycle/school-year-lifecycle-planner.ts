import { Class as ClassEntity } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";

import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import {
  SchoolYearLifecycleRepository,
  SchoolYearLifecycleSourceCandidate,
} from "../../ports/school-year-lifecycle.repository";
import {
  isLifecycleDateWithinSchoolYear,
  SchoolYearLifecycleConflictCode,
  SchoolYearLifecycleOperation,
  SchoolYearLifecycleOutcome,
  SchoolYearLifecyclePreviewInput,
  SchoolYearLifecyclePreviewRow,
  SchoolYearLifecycleRowInput,
} from "../../school-year-lifecycle";

export interface SchoolYearLifecyclePlannerDeps {
  lifecycleRepository: SchoolYearLifecycleRepository;
  schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository;
  classRepository: ClassRepository;
}

export interface SchoolYearLifecyclePlannedRow {
  row: SchoolYearLifecyclePreviewRow;
  input: {
    studentId: string;
    outcome?: SchoolYearLifecycleOutcome;
    targetClassId?: string;
    note?: string;
  };
  candidate: SchoolYearLifecycleSourceCandidate | null;
  targetClass: ClassEntity | null;
}

export interface SchoolYearLifecyclePlan {
  rows: SchoolYearLifecyclePlannedRow[];
}

export async function buildSchoolYearLifecyclePlan(
  input: SchoolYearLifecyclePreviewInput,
  sourceSchoolYear: SchoolYear,
  targetSchoolYear: SchoolYear,
  deps: SchoolYearLifecyclePlannerDeps,
): Promise<SchoolYearLifecyclePlan> {
  const explicitStudentIds = input.rows.map((row) => row.studentId);
  const candidates = await deps.lifecycleRepository.findOpenSourceCandidates(
    input.campusId,
    input.sourceSchoolYearId,
    explicitStudentIds.length > 0 ? explicitStudentIds : undefined,
    input.sourceClosureDate,
  );
  const candidatesByStudent = new Map(
    candidates.map((candidate) => [
      candidate.schoolYearEnrollment.studentId,
      candidate,
    ]),
  );

  const plannedInputs: SchoolYearLifecycleRowInput[] =
    input.rows.length > 0
      ? input.rows
      : candidates.map((candidate) => ({
          studentId: candidate.schoolYearEnrollment.studentId,
        }));

  const targetClassIds = Array.from(
    new Set(
      plannedInputs
        .map((row) => row.targetClassId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const targetClasses = await deps.classRepository.findByIds(targetClassIds);
  const targetClassesById = new Map(
    targetClasses.map((classEntity) => [classEntity.id, classEntity]),
  );
  const [targetRegistrationStudentIds, cancelledTargetStudentIds] =
    await Promise.all([
      deps.lifecycleRepository.findOpenTargetRegistrationStudentIds(
        input.campusId,
        input.targetSchoolYearId,
        plannedInputs.map((row) => row.studentId),
      ),
      deps.lifecycleRepository.findCancelledTargetRegistrationStudentIds(
        input.campusId,
        input.targetSchoolYearId,
        plannedInputs.map((row) => row.studentId),
      ),
    ]);
  const targetRegistrationStudentIdSet = new Set(targetRegistrationStudentIds);
  const cancelledTargetStudentIdSet = new Set(cancelledTargetStudentIds);

  const sourceDateValid = isLifecycleDateWithinSchoolYear(
    input.sourceClosureDate,
    sourceSchoolYear,
  );
  const targetDateValid = isLifecycleDateWithinSchoolYear(
    input.targetEnrollmentDate,
    targetSchoolYear,
  );

  const rows: SchoolYearLifecyclePlannedRow[] = [];
  for (const rowInput of plannedInputs) {
    const candidate = candidatesByStudent.get(rowInput.studentId) ?? null;
    const targetClass = rowInput.targetClassId
      ? (targetClassesById.get(rowInput.targetClassId) ?? null)
      : null;
    const outcome = resolveOutcome(
      rowInput.outcome,
      Boolean(rowInput.targetClassId),
      targetClass,
      candidate,
    );
    const conflictCodes: SchoolYearLifecycleConflictCode[] = [];

    if (!candidate) {
      conflictCodes.push("MISSING_SOURCE_REGISTRATION");
    }

    if (outcome !== "SKIP" && (!sourceDateValid || !targetDateValid)) {
      conflictCodes.push("INVALID_DATE");
    }

    if (outcome === "PROMOTE" || outcome === "RETAIN") {
      if (
        !rowInput.targetClassId ||
        !targetClass ||
        targetClass.campusId !== input.campusId ||
        targetClass.schoolYearId !== input.targetSchoolYearId
      ) {
        conflictCodes.push("MISSING_TARGET_CLASS");
      } else if (
        candidate &&
        !targetClassMatchesOutcome(outcome, candidate, targetClass)
      ) {
        conflictCodes.push("GRADE_LEVEL_MISMATCH");
      }
    }

    if (
      candidate &&
      outcome !== "SKIP" &&
      targetRegistrationStudentIdSet.has(rowInput.studentId)
    ) {
      conflictCodes.push("EXISTING_TARGET_REGISTRATION");
    }
    if (
      candidate &&
      outcome !== "SKIP" &&
      cancelledTargetStudentIdSet.has(rowInput.studentId)
    ) {
      conflictCodes.push("CANCELLED_TARGET_REGISTRATION");
    }

    const context = buildContext(candidate, targetClass);
    const operations =
      conflictCodes.length === 0
        ? buildOperations(outcome, candidate, targetClass)
        : [];

    rows.push({
      input: rowInput,
      candidate,
      targetClass,
      row: {
        studentId: rowInput.studentId,
        outcome,
        targetClassId: rowInput.targetClassId,
        status:
          outcome === "SKIP"
            ? "SKIPPED"
            : conflictCodes.length > 0
              ? "CONFLICT"
              : "READY",
        conflictCode: conflictCodes[0],
        conflictCodes,
        operations,
        context,
      },
    });
  }

  return { rows };
}

function resolveOutcome(
  explicit: SchoolYearLifecycleOutcome | undefined,
  hasTargetClassAssignment: boolean,
  targetClass: ClassEntity | null,
  candidate: SchoolYearLifecycleSourceCandidate | null,
): SchoolYearLifecycleOutcome {
  if (explicit) {
    return explicit;
  }
  if (hasTargetClassAssignment && !targetClass) {
    return "PROMOTE";
  }
  if (!targetClass) {
    return "PROMOTE";
  }
  if (
    candidate &&
    targetClass.gradeLevelId === candidate.schoolYearEnrollment.gradeLevelId
  ) {
    return "RETAIN";
  }
  return "PROMOTE";
}

function targetClassMatchesOutcome(
  outcome: SchoolYearLifecycleOutcome,
  candidate: SchoolYearLifecycleSourceCandidate,
  targetClass: ClassEntity,
): boolean {
  if (outcome === "RETAIN") {
    return (
      targetClass.gradeLevelId === candidate.schoolYearEnrollment.gradeLevelId
    );
  }

  const sourceOrder = candidate.schoolYearEnrollment.gradeLevel?.order;
  const targetOrder = targetClass.gradeLevel?.order;
  if (typeof sourceOrder !== "number" || typeof targetOrder !== "number") {
    return true;
  }
  return targetOrder === sourceOrder + 1;
}

function buildOperations(
  outcome: SchoolYearLifecycleOutcome,
  candidate: SchoolYearLifecycleSourceCandidate | null,
  targetClass: ClassEntity | null,
) {
  if (outcome === "SKIP") {
    return [{ type: "SKIP" as const }];
  }

  const operations: SchoolYearLifecycleOperation[] = [
    {
      type: "CLOSE_SOURCE_SCHOOL_YEAR_ENROLLMENT" as const,
      sourceId: candidate?.schoolYearEnrollment.id,
    },
  ];

  if (candidate?.activeEnrollment) {
    operations.push({
      type: "CLOSE_SOURCE_CLASS_ENROLLMENT" as const,
      sourceId: candidate.activeEnrollment.id,
    });
  }

  if (outcome === "GRADUATE") {
    operations.push({ type: "GRADUATE" as const });
    return operations;
  }

  if (outcome === "RETAIN") {
    operations.push({ type: "RETAIN" });
  }

  operations.push({
    type: "CREATE_TARGET_SCHOOL_YEAR_ENROLLMENT" as const,
    targetId: targetClass?.gradeLevelId,
  });
  operations.push({
    type: "CREATE_TARGET_CLASS_ENROLLMENT" as const,
    targetId: targetClass?.id,
  });
  return operations;
}

function buildContext(
  candidate: SchoolYearLifecycleSourceCandidate | null,
  targetClass: ClassEntity | null,
) {
  return {
    studentName: candidate?.schoolYearEnrollment.student?.fullName ?? null,
    sourceSchoolYearEnrollmentId: candidate?.schoolYearEnrollment.id,
    sourceClassEnrollmentId: candidate?.activeEnrollment?.id,
    sourceGradeLevelId: candidate?.schoolYearEnrollment.gradeLevelId,
    sourceGradeLevelName:
      candidate?.schoolYearEnrollment.gradeLevel?.name ?? null,
    sourceGradeLevelOrder:
      candidate?.schoolYearEnrollment.gradeLevel?.order ?? null,
    targetClassId: targetClass?.id,
    targetClassName: targetClass?.name ?? null,
    targetGradeLevelId: targetClass?.gradeLevelId,
    targetGradeLevelName: targetClass?.gradeLevel?.name ?? null,
    targetGradeLevelOrder: targetClass?.gradeLevel?.order ?? null,
  };
}
