import { WeeklyPlan } from "@/domain/weekly-plan";
import { User } from "@/domain/user-management/user.entity";

const SYSTEM_AUDIT_ACTOR_ID = "00000000-0000-4000-8000-000000000000";

export function getWeeklyPlanAuditActorId(currentUser?: User): string {
  return currentUser?.id ?? SYSTEM_AUDIT_ACTOR_ID;
}

export function buildWeeklyPlanAuditSnapshot(
  plan: WeeklyPlan,
): Record<string, unknown> {
  const classroom = plan.classroom;
  const blockCount = plan.blocks.length;
  const activityCount = plan.blocks.reduce(
    (count, block) => count + block.activities.length,
    0,
  );

  return {
    targetName: classroom
      ? `${classroom.name} ${plan.weekStartDate.toISOString().slice(0, 10)}`
      : `Weekly Plan ${plan.weekStartDate.toISOString().slice(0, 10)}`,
    classId: plan.classId,
    className: classroom?.name ?? null,
    gradeLevelId: classroom?.gradeLevelId ?? null,
    gradeLevelName: classroom?.gradeLevelName ?? null,
    schoolYearId: classroom?.schoolYearId ?? null,
    schoolYearName: classroom?.schoolYearName ?? null,
    weekStartDate: plan.weekStartDate.toISOString(),
    theme: plan.theme,
    blockCount,
    activityCount,
    isArchived: plan.isArchived,
  };
}

export function buildWeeklyPlanAuditContext(
  plan: WeeklyPlan,
  currentUser?: User,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    actorName: currentUser?.profile?.fullName ?? null,
    ...buildWeeklyPlanAuditSnapshot(plan),
    ...extra,
  };
}
