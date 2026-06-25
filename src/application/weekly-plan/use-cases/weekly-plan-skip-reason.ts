export const WEEKLY_PLAN_SKIPPED_REASONS = [
  "CLASS_NOT_FOUND",
  "ACTIVE_WEEKLY_PLAN_EXISTS",
] as const;

export type WeeklyPlanSkippedReason =
  (typeof WEEKLY_PLAN_SKIPPED_REASONS)[number];

export interface WeeklyPlanSkippedClass {
  classId: string;
  reason: WeeklyPlanSkippedReason;
  message: string;
}
