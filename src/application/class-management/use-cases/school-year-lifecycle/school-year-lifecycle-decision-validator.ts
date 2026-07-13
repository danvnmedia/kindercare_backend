import { Class as ClassEntity } from "@/domain/class-management/entities/class.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";

import { SaveSchoolYearLifecycleDecisionMutation } from "../../ports/school-year-lifecycle.repository";
import {
  SchoolYearLifecycleCandidate,
  SchoolYearLifecycleDecisionInput,
  SchoolYearLifecycleDecisionRejection,
} from "../../school-year-lifecycle";

export function validateSchoolYearLifecycleDecisions(input: {
  campusId: string;
  targetSchoolYearId: string;
  candidates: SchoolYearLifecycleCandidate[];
  decisions: SchoolYearLifecycleDecisionInput[];
  targetClasses: ClassEntity[];
  gradeLevels: GradeLevel[];
}): {
  accepted: SaveSchoolYearLifecycleDecisionMutation[];
  rejected: SchoolYearLifecycleDecisionRejection[];
} {
  const candidateById = new Map(
    input.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const classById = new Map(
    input.targetClasses.map((classEntity) => [classEntity.id, classEntity]),
  );
  const gradeOrderById = new Map(
    input.gradeLevels.map((gradeLevel) => [gradeLevel.id, gradeLevel.order]),
  );
  const highestGradeOrder = input.gradeLevels.at(-1)?.order ?? null;
  const accepted: SaveSchoolYearLifecycleDecisionMutation[] = [];
  const rejected: SchoolYearLifecycleDecisionRejection[] = [];

  for (const decision of input.decisions) {
    const candidate = candidateById.get(decision.candidateId);
    if (!candidate) {
      rejected.push(rejection(decision.candidateId, "CANDIDATE_NOT_FOUND"));
      continue;
    }
    if (candidate.committedAt) {
      rejected.push(rejection(decision.candidateId, "CANDIDATE_COMMITTED"));
      continue;
    }
    if (candidate.status === "NO_LONGER_ELIGIBLE") {
      rejected.push(
        rejection(decision.candidateId, "CANDIDATE_NO_LONGER_ELIGIBLE"),
      );
      continue;
    }

    const sourceGradeOrder = gradeOrderById.get(candidate.sourceGradeLevelId);
    if (decision.outcome === "SKIP") {
      if (decision.targetClassId) {
        rejected.push(rejection(decision.candidateId, "INVALID_DECISION"));
        continue;
      }
      accepted.push({
        candidateId: candidate.id,
        decision: "SKIP",
        targetGradeLevelId: null,
        targetClassId: null,
        decisionNote: decision.note?.trim() || null,
        status: "READY",
      });
      continue;
    }

    if (decision.outcome === "GRADUATE") {
      if (
        decision.targetClassId ||
        sourceGradeOrder === undefined ||
        sourceGradeOrder !== highestGradeOrder
      ) {
        rejected.push(
          rejection(decision.candidateId, "GRADUATION_NOT_ALLOWED"),
        );
        continue;
      }
      accepted.push({
        candidateId: candidate.id,
        decision: "GRADUATE",
        targetGradeLevelId: null,
        targetClassId: null,
        decisionNote: decision.note?.trim() || null,
        status: "READY",
      });
      continue;
    }

    const targetClass = decision.targetClassId
      ? classById.get(decision.targetClassId)
      : null;
    if (
      !targetClass ||
      targetClass.campusId !== input.campusId ||
      targetClass.schoolYearId !== input.targetSchoolYearId
    ) {
      rejected.push(rejection(decision.candidateId, "INVALID_TARGET_CLASS"));
      continue;
    }
    const targetGradeOrder = gradeOrderById.get(targetClass.gradeLevelId);
    const gradeMatches =
      decision.outcome === "RETAIN"
        ? targetClass.gradeLevelId === candidate.sourceGradeLevelId
        : sourceGradeOrder !== undefined &&
          targetGradeOrder === sourceGradeOrder + 1;
    if (!gradeMatches) {
      rejected.push(rejection(decision.candidateId, "INVALID_TARGET_CLASS"));
      continue;
    }

    accepted.push({
      candidateId: candidate.id,
      decision: decision.outcome,
      targetGradeLevelId: targetClass.gradeLevelId,
      targetClassId: targetClass.id,
      decisionNote: decision.note?.trim() || null,
      status: "READY",
    });
  }

  return { accepted, rejected };
}

function rejection(
  candidateId: string,
  code: SchoolYearLifecycleDecisionRejection["code"],
): SchoolYearLifecycleDecisionRejection {
  return { candidateId, code, message: code };
}
