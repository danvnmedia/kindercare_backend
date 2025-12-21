import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Class } from "./class.entity";

export interface GradeLevelProps {
  name: string;
  order: number;
  isArchived: boolean;
  classes?: Class[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateGradeLevelData = Omit<
  GradeLevelProps,
  "createdAt" | "updatedAt" | "classes" | "isArchived"
>;

export type UpdateGradeLevelData = Partial<
  Pick<GradeLevelProps, "name" | "order" | "isArchived">
>;

export class GradeLevel extends Entity<GradeLevelProps> {
  // --- Getters ---
  get name(): string {
    return this.props.name;
  }

  get order(): number {
    return this.props.order;
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

  get classes(): Class[] | undefined {
    return this.props.classes;
  }

  // --- Domain Methods ---

  public updateName(name: string): void {
    if (!name || name.trim().length < 1) {
      throw new Error("Grade level name is required");
    }
    this.props.name = name.trim();
    this.touch();
  }

  public updateOrder(order: number): void {
    if (order < 0) {
      throw new Error("Order must be a non-negative number");
    }
    this.props.order = order;
    this.touch();
  }

  public archive(): void {
    this.props.isArchived = true;
    this.touch();
  }

  public unarchive(): void {
    this.props.isArchived = false;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  public static create(
    props: Optional<
      GradeLevelProps,
      "createdAt" | "updatedAt" | "classes" | "isArchived"
    >,
    id?: string,
  ): GradeLevel {
    // Validation
    if (!props.name || props.name.trim().length < 1) {
      throw new Error("Grade level name is required");
    }
    if (props.order < 0) {
      throw new Error("Order must be a non-negative number");
    }

    const gradeLevelProps: GradeLevelProps = {
      ...props,
      name: props.name.trim(),
      isArchived: props.isArchived ?? false,
      classes: props.classes,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new GradeLevel(
      gradeLevelProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
