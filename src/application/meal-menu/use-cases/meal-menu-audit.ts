import { MealMenu, MealMenuConfig } from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

const SYSTEM_AUDIT_ACTOR_ID = "00000000-0000-4000-8000-000000000000";

export function getMealMenuAuditActorId(currentUser?: User): string {
  return currentUser?.id ?? SYSTEM_AUDIT_ACTOR_ID;
}

export function buildMealMenuAuditSnapshot(
  menu: MealMenu,
): Record<string, unknown> {
  return {
    title: menu.title,
    weekStartDate: menu.weekStartDate.toISOString(),
    targetType: menu.targetType,
    gradeLevelId: menu.gradeLevelId,
    gradeLevelName: menu.gradeLevel?.name ?? null,
    classId: menu.classId,
    className: menu.classroom?.name ?? null,
    days: menu.days,
    mealSlots: menu.mealSlots,
    entryCount: menu.entries.length,
    isArchived: menu.isArchived,
  };
}

export function buildMealMenuAuditContext(
  menu: MealMenu,
  currentUser?: User,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    actorName: currentUser?.profile?.fullName ?? null,
    ...buildMealMenuAuditSnapshot(menu),
    ...extra,
  };
}

export function buildMealMenuConfigAuditSnapshot(
  config: MealMenuConfig,
): Record<string, unknown> {
  return {
    operatingDays: config.operatingDays,
    defaultMealSlots: config.defaultMealSlots,
  };
}

export function buildMealMenuConfigAuditContext(
  config: MealMenuConfig,
  currentUser?: User,
): Record<string, unknown> {
  return {
    actorName: currentUser?.profile?.fullName ?? null,
    ...buildMealMenuConfigAuditSnapshot(config),
  };
}
