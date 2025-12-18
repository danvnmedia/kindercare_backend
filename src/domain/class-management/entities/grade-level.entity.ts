import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface GradeLevelProps {
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateGradeLevelData = Omit<
  GradeLevelProps,
  "createdAt" | "updatedAt"
>;

export class GradeLevel extends Entity<GradeLevelProps> {
  // --- Getters ---
  get name(): string {
    return this.props.name;
  }

  get order(): number {
    return this.props.order;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
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

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  public static create(
    props: Optional<GradeLevelProps, "createdAt" | "updatedAt">,
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
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new GradeLevel(
      gradeLevelProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
