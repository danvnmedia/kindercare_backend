import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import {
  cloneWeeklyPlanBlocks,
  normalizeOptionalTheme,
  normalizeWeekStartDate,
  normalizeWeeklyPlanBlocks,
  WeeklyPlanBlock,
  WeeklyPlanBlockInput,
} from "../weekly-plan-schedule";

export interface WeeklyPlanClassSnapshot {
  id: string;
  name: string;
  gradeLevelId?: string | null;
  gradeLevelName?: string | null;
  schoolYearId?: string | null;
  schoolYearName?: string | null;
}

export interface WeeklyPlanProps {
  campusId: string;
  classId: string;
  classroom: WeeklyPlanClassSnapshot | null;
  weekStartDate: Date;
  theme: string | null;
  blocks: WeeklyPlanBlock[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateWeeklyPlanData {
  classId?: string;
  classroom?: WeeklyPlanClassSnapshot | null;
  weekStartDate?: Date;
  theme?: string | null;
  blocks?: WeeklyPlanBlockInput[];
}

export type CreateWeeklyPlanData = Optional<
  Omit<WeeklyPlanProps, "blocks"> & {
    blocks?: WeeklyPlanBlockInput[];
  },
  "classroom" | "theme" | "blocks" | "isArchived" | "createdAt" | "updatedAt"
>;

export class WeeklyPlan extends Entity<WeeklyPlanProps> {
  get campusId(): string {
    return this.props.campusId;
  }

  get classId(): string {
    return this.props.classId;
  }

  get classroom(): WeeklyPlanClassSnapshot | null {
    return this.props.classroom ? { ...this.props.classroom } : null;
  }

  get weekStartDate(): Date {
    return this.props.weekStartDate;
  }

  get theme(): string | null {
    return this.props.theme;
  }

  get blocks(): WeeklyPlanBlock[] {
    return cloneWeeklyPlanBlocks(this.props.blocks);
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

  public update(data: UpdateWeeklyPlanData): void {
    if (data.classId !== undefined) {
      if (!data.classId) {
        throw new Error("Class ID is required for weekly plan");
      }
      this.props.classId = data.classId;
    }

    if (data.classroom !== undefined) {
      WeeklyPlan.assertClassSnapshot(data.classroom, this.props.classId);
      this.props.classroom = data.classroom ? { ...data.classroom } : null;
    }

    if (data.weekStartDate !== undefined) {
      this.props.weekStartDate = normalizeWeekStartDate(data.weekStartDate);
    }

    if (data.theme !== undefined) {
      this.props.theme = normalizeOptionalTheme(data.theme);
    }

    if (data.blocks !== undefined) {
      this.props.blocks = normalizeWeeklyPlanBlocks(data.blocks);
    }

    this.touch();
  }

  public replaceSchedule(blocks: WeeklyPlanBlockInput[]): void {
    this.props.blocks = normalizeWeeklyPlanBlocks(blocks);
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
      throw new Error("Archived weekly plans cannot be mutated");
    }
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  public static create(props: CreateWeeklyPlanData, id?: string): WeeklyPlan {
    if (!props.campusId) {
      throw new Error("Campus ID is required for weekly plan");
    }
    if (!props.classId) {
      throw new Error("Class ID is required for weekly plan");
    }

    WeeklyPlan.assertClassSnapshot(props.classroom ?? null, props.classId);

    const weeklyPlanProps: WeeklyPlanProps = {
      campusId: props.campusId,
      classId: props.classId,
      classroom: props.classroom ? { ...props.classroom } : null,
      weekStartDate: normalizeWeekStartDate(props.weekStartDate),
      theme: normalizeOptionalTheme(props.theme),
      blocks: normalizeWeeklyPlanBlocks(props.blocks),
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new WeeklyPlan(
      weeklyPlanProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  private static assertClassSnapshot(
    classroom: WeeklyPlanClassSnapshot | null,
    classId: string,
  ): void {
    if (classroom && classroom.id !== classId) {
      throw new Error("Weekly plan class snapshot must match classId");
    }
  }
}
