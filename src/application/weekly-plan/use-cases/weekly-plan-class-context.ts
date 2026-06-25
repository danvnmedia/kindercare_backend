import { Class } from "@/domain/class-management/entities/class.entity";
import { WeeklyPlanClassSnapshot } from "@/domain/weekly-plan";

export function toWeeklyPlanClassSnapshot(
  classroom: Class,
): WeeklyPlanClassSnapshot {
  return {
    id: classroom.id,
    name: classroom.name,
    gradeLevelId: classroom.gradeLevelId,
    gradeLevelName: classroom.gradeLevel?.name ?? null,
    schoolYearId: classroom.schoolYearId,
    schoolYearName: classroom.schoolYear?.name ?? null,
  };
}
