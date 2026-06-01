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

export interface MealMenuProps {
  campusId: string;
  gradeLevelId: string | null;
  gradeLevel: MealMenuGradeLevelSnapshot | null;
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
  gradeLevelId?: string | null;
  gradeLevel?: MealMenuGradeLevelSnapshot | null;
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
  | "gradeLevel"
  | "gradeLevelId"
>;

export class MealMenu extends Entity<MealMenuProps> {
  get campusId(): string {
    return this.props.campusId;
  }

  get gradeLevelId(): string | null {
    return this.props.gradeLevelId;
  }

  get gradeLevel(): MealMenuGradeLevelSnapshot | null {
    return this.props.gradeLevel ? { ...this.props.gradeLevel } : null;
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

    if (data.weekStartDate !== undefined) {
      this.props.weekStartDate = normalizeWeekStartDate(data.weekStartDate);
    }
    if (data.gradeLevelId !== undefined) {
      this.props.gradeLevelId = data.gradeLevelId;
      if (data.gradeLevelId === null) {
        this.props.gradeLevel = null;
      }
    }
    if (data.gradeLevel !== undefined) {
      MealMenu.assertGradeLevelSnapshotMatchesTarget(
        this.props.gradeLevelId,
        data.gradeLevel,
      );
      this.props.gradeLevel = data.gradeLevel ? { ...data.gradeLevel } : null;
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
    MealMenu.assertGradeLevelSnapshotMatchesTarget(
      gradeLevelId,
      props.gradeLevel ?? null,
    );

    const days = normalizeDays(
      props.days ?? [...DEFAULT_MEAL_MENU_OPERATING_DAYS],
    );
    const mealSlots = normalizeMealSlots(
      props.mealSlots ?? [...DEFAULT_MEAL_MENU_SLOTS],
    );

    const mealMenuProps: MealMenuProps = {
      campusId: props.campusId,
      gradeLevelId,
      gradeLevel: props.gradeLevel ? { ...props.gradeLevel } : null,
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

  private static assertGradeLevelSnapshotMatchesTarget(
    gradeLevelId: string | null,
    gradeLevel: MealMenuGradeLevelSnapshot | null,
  ): void {
    if (gradeLevelId === null && gradeLevel !== null) {
      throw new Error("Whole-campus meal menus cannot include a grade level");
    }
    if (gradeLevelId !== null && gradeLevel && gradeLevel.id !== gradeLevelId) {
      throw new Error("Meal menu grade level snapshot must match gradeLevelId");
    }
  }
}
