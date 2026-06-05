import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import {
  cloneMealMenuEntries,
  DEFAULT_MEAL_MENU_OPERATING_DAYS,
  DEFAULT_MEAL_MENU_SLOTS,
  MealMenuDayOfWeek,
  MealMenuEntry,
  MealMenuEntryInput,
  normalizeDays,
  normalizeMealMenuEntries,
  normalizeMealSlots,
  normalizeOptionalTitle,
  normalizeWeekStartDate,
} from "../meal-menu-grid";

export interface MealMenuGradeLevelSnapshot {
  id: string;
  name: string;
}

export interface MealMenuClassSnapshot {
  id: string;
  name: string;
  gradeLevelId: string;
}

export const MEAL_MENU_TARGET_TYPES = ["campus", "grade", "class"] as const;

export type MealMenuTargetType = (typeof MEAL_MENU_TARGET_TYPES)[number];

export type MealMenuTargetIdentity =
  | {
      targetType: "campus";
      gradeLevelId: null;
      classId: null;
    }
  | {
      targetType: "grade";
      gradeLevelId: string;
      classId: null;
    }
  | {
      targetType: "class";
      gradeLevelId: null;
      classId: string;
    };

export interface MealMenuProps {
  campusId: string;
  targetType: MealMenuTargetType;
  gradeLevelId: string | null;
  classId: string | null;
  gradeLevel: MealMenuGradeLevelSnapshot | null;
  classroom: MealMenuClassSnapshot | null;
  weekStartDate: Date;
  title: string | null;
  days: MealMenuDayOfWeek[];
  mealSlots: string[];
  entries: MealMenuEntry[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateMealMenuData {
  targetType?: MealMenuTargetType;
  gradeLevelId?: string | null;
  classId?: string | null;
  gradeLevel?: MealMenuGradeLevelSnapshot | null;
  classroom?: MealMenuClassSnapshot | null;
  weekStartDate?: Date;
  title?: string | null;
  days?: number[];
  mealSlots?: string[];
  entries?: MealMenuEntryInput[];
}

export type CreateMealMenuData = Optional<
  Omit<MealMenuProps, "days" | "entries"> & {
    days: number[];
    entries: MealMenuEntryInput[];
  },
  | "createdAt"
  | "updatedAt"
  | "isArchived"
  | "entries"
  | "days"
  | "mealSlots"
  | "title"
  | "targetType"
  | "gradeLevel"
  | "gradeLevelId"
  | "classroom"
  | "classId"
>;

export class MealMenu extends Entity<MealMenuProps> {
  get campusId(): string {
    return this.props.campusId;
  }

  get gradeLevelId(): string | null {
    return this.props.gradeLevelId;
  }

  get classId(): string | null {
    return this.props.classId;
  }

  get targetType(): MealMenuTargetType {
    return this.props.targetType;
  }

  get targetIdentity(): MealMenuTargetIdentity {
    switch (this.props.targetType) {
      case "campus":
        return { targetType: "campus", gradeLevelId: null, classId: null };
      case "grade":
        return {
          targetType: "grade",
          gradeLevelId: this.props.gradeLevelId as string,
          classId: null,
        };
      case "class":
        return {
          targetType: "class",
          gradeLevelId: null,
          classId: this.props.classId as string,
        };
    }
  }

  get gradeLevel(): MealMenuGradeLevelSnapshot | null {
    return this.props.gradeLevel ? { ...this.props.gradeLevel } : null;
  }

  get classroom(): MealMenuClassSnapshot | null {
    return this.props.classroom ? { ...this.props.classroom } : null;
  }

  get weekStartDate(): Date {
    return this.props.weekStartDate;
  }

  get title(): string | null {
    return this.props.title;
  }

  get days(): MealMenuDayOfWeek[] {
    return [...this.props.days];
  }

  get mealSlots(): string[] {
    return [...this.props.mealSlots];
  }

  get entries(): MealMenuEntry[] {
    return cloneMealMenuEntries(this.props.entries);
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public update(data: UpdateMealMenuData): void {
    const nextDays =
      data.days !== undefined ? normalizeDays(data.days) : this.props.days;
    const nextMealSlots =
      data.mealSlots !== undefined
        ? normalizeMealSlots(data.mealSlots)
        : this.props.mealSlots;
    const nextEntries =
      data.entries !== undefined ||
      data.days !== undefined ||
      data.mealSlots !== undefined
        ? normalizeMealMenuEntries(
            data.entries ?? this.props.entries,
            nextDays,
            nextMealSlots,
          )
        : this.props.entries;

    this.updateTarget(data);

    if (data.weekStartDate !== undefined) {
      this.props.weekStartDate = normalizeWeekStartDate(data.weekStartDate);
    }
    if (data.title !== undefined) {
      this.props.title = normalizeOptionalTitle(data.title);
    }

    this.props.days = nextDays;
    this.props.mealSlots = nextMealSlots;
    this.props.entries = nextEntries;
    this.touch();
  }

  public replaceGrid(data: {
    days: number[];
    mealSlots: string[];
    entries: MealMenuEntryInput[];
  }): void {
    const days = normalizeDays(data.days);
    const mealSlots = normalizeMealSlots(data.mealSlots);
    const entries = normalizeMealMenuEntries(data.entries, days, mealSlots);

    this.props.days = days;
    this.props.mealSlots = mealSlots;
    this.props.entries = entries;
    this.touch();
  }

  public archive(): void {
    if (this.props.isArchived) return;
    this.props.isArchived = true;
    this.touch();
  }

  public restore(): void {
    if (!this.props.isArchived) return;
    this.props.isArchived = false;
    this.touch();
  }

  public ensureActive(): void {
    if (this.props.isArchived) {
      throw new Error("Archived meal menus cannot be mutated");
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  public static create(props: CreateMealMenuData, id?: string): MealMenu {
    if (!props.campusId) {
      throw new Error("Campus ID is required for meal menu");
    }

    const gradeLevelId = props.gradeLevelId ?? null;
    const classId = props.classId ?? null;
    const targetType =
      props.targetType ?? MealMenu.inferTargetType(gradeLevelId, classId);

    MealMenu.assertTargetIdentity(
      targetType,
      gradeLevelId,
      classId,
      props.gradeLevel ?? null,
      props.classroom ?? null,
    );

    const days = normalizeDays(
      props.days ?? [...DEFAULT_MEAL_MENU_OPERATING_DAYS],
    );
    const mealSlots = normalizeMealSlots(
      props.mealSlots ?? [...DEFAULT_MEAL_MENU_SLOTS],
    );

    const mealMenuProps: MealMenuProps = {
      campusId: props.campusId,
      targetType,
      gradeLevelId,
      classId,
      gradeLevel: props.gradeLevel ? { ...props.gradeLevel } : null,
      classroom: props.classroom ? { ...props.classroom } : null,
      weekStartDate: normalizeWeekStartDate(props.weekStartDate),
      title: normalizeOptionalTitle(props.title),
      days,
      mealSlots,
      entries: normalizeMealMenuEntries(props.entries ?? [], days, mealSlots),
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new MealMenu(mealMenuProps, id ? new UniqueEntityID(id) : undefined);
  }

  private updateTarget(data: UpdateMealMenuData): void {
    if (
      data.targetType === undefined &&
      data.gradeLevelId === undefined &&
      data.classId === undefined &&
      data.gradeLevel === undefined &&
      data.classroom === undefined
    ) {
      return;
    }

    const gradeLevelId =
      data.gradeLevelId !== undefined
        ? data.gradeLevelId
        : this.props.gradeLevelId;
    const classId =
      data.classId !== undefined ? data.classId : this.props.classId;
    const targetType =
      data.targetType ?? MealMenu.inferTargetType(gradeLevelId, classId);
    const gradeLevel =
      data.gradeLevel !== undefined ? data.gradeLevel : this.props.gradeLevel;
    const classroom =
      data.classroom !== undefined ? data.classroom : this.props.classroom;

    MealMenu.assertTargetIdentity(
      targetType,
      gradeLevelId,
      classId,
      gradeLevel,
      classroom,
    );

    this.props.targetType = targetType;
    this.props.gradeLevelId = gradeLevelId;
    this.props.classId = classId;
    this.props.gradeLevel = gradeLevel ? { ...gradeLevel } : null;
    this.props.classroom = classroom ? { ...classroom } : null;
  }

  private static inferTargetType(
    gradeLevelId: string | null,
    classId: string | null,
  ): MealMenuTargetType {
    if (classId !== null) return "class";
    if (gradeLevelId !== null) return "grade";
    return "campus";
  }

  private static assertTargetIdentity(
    targetType: MealMenuTargetType,
    gradeLevelId: string | null,
    classId: string | null,
    gradeLevel: MealMenuGradeLevelSnapshot | null,
    classroom: MealMenuClassSnapshot | null,
  ): void {
    if (targetType === "campus") {
      if (gradeLevelId !== null || classId !== null) {
        throw new Error(
          "Campus meal menus cannot include gradeLevelId or classId",
        );
      }
      if (gradeLevel !== null || classroom !== null) {
        throw new Error("Campus meal menus cannot include target snapshots");
      }
      return;
    }

    if (targetType === "grade") {
      if (gradeLevelId === null) {
        throw new Error("Grade meal menus require gradeLevelId");
      }
      if (classId !== null || classroom !== null) {
        throw new Error("Grade meal menus cannot include classId");
      }
      if (gradeLevel && gradeLevel.id !== gradeLevelId) {
        throw new Error(
          "Meal menu grade level snapshot must match gradeLevelId",
        );
      }
      return;
    }

    if (targetType === "class") {
      if (classId === null) {
        throw new Error("Class meal menus require classId");
      }
      if (gradeLevelId !== null || gradeLevel !== null) {
        throw new Error("Class meal menus cannot include gradeLevelId");
      }
      if (classroom && classroom.id !== classId) {
        throw new Error("Meal menu class snapshot must match classId");
      }
      return;
    }
  }
}
