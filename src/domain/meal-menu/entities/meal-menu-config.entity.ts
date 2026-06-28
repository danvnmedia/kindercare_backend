import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import {
  DEFAULT_MEAL_MENU_OPERATING_DAYS,
  DEFAULT_MEAL_MENU_SLOTS,
  MealMenuDayOfWeek,
  normalizeDays,
  normalizeMealSlots,
} from "../meal-menu-grid";

export interface MealMenuConfigProps {
  campusId: string;
  operatingDays: MealMenuDayOfWeek[];
  defaultMealSlots: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateMealMenuConfigData {
  operatingDays?: number[];
  defaultMealSlots?: string[];
}

export type CreateMealMenuConfigData = Optional<
  Omit<MealMenuConfigProps, "operatingDays"> & { operatingDays: number[] },
  "createdAt" | "updatedAt" | "operatingDays" | "defaultMealSlots"
>;

export class MealMenuConfig extends Entity<MealMenuConfigProps> {
  get campusId(): string {
    return this.props.campusId;
  }

  get operatingDays(): MealMenuDayOfWeek[] {
    return [...this.props.operatingDays];
  }

  get defaultMealSlots(): string[] {
    return [...this.props.defaultMealSlots];
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public update(data: UpdateMealMenuConfigData): void {
    if (data.operatingDays !== undefined) {
      this.props.operatingDays = normalizeDays(
        data.operatingDays,
        "operatingDays",
      );
    }
    if (data.defaultMealSlots !== undefined) {
      this.props.defaultMealSlots = normalizeMealSlots(
        data.defaultMealSlots,
        "defaultMealSlots",
      );
    }
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  public static create(
    props: CreateMealMenuConfigData,
    id?: string,
  ): MealMenuConfig {
    if (!props.campusId) {
      throw new Error("Campus ID is required for meal menu config");
    }

    const configProps: MealMenuConfigProps = {
      campusId: props.campusId,
      operatingDays: normalizeDays(
        props.operatingDays ?? [...DEFAULT_MEAL_MENU_OPERATING_DAYS],
        "operatingDays",
      ),
      defaultMealSlots: normalizeMealSlots(
        props.defaultMealSlots ?? [...DEFAULT_MEAL_MENU_SLOTS],
        "defaultMealSlots",
      ),
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new MealMenuConfig(
      configProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
