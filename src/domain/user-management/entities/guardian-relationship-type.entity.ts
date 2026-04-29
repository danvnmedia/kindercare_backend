import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface GuardianRelationshipTypeProps {
  campusId: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UpdateGuardianRelationshipTypeData = Partial<
  Omit<GuardianRelationshipTypeProps, "campusId" | "createdAt" | "updatedAt">
>;

export class GuardianRelationshipType extends Entity<GuardianRelationshipTypeProps> {
  // --- Getters ---

  get campusId(): string {
    return this.props.campusId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
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

  public update(data: UpdateGuardianRelationshipTypeData): void {
    if (data.name !== undefined) {
      this.validateName(data.name);
      this.props.name = data.name.trim();
    }

    if (data.description !== undefined) {
      this.props.description = data.description?.trim() || null;
    }

    if (data.isArchived !== undefined) {
      this.props.isArchived = data.isArchived;
    }

    if (data.order !== undefined) {
      this.validateOrder(data.order);
      this.props.order = data.order;
    }

    this.touch();
  }

  public updateOrder(order: number): void {
    this.validateOrder(order);
    this.props.order = order;
    this.touch();
  }

  public archive(): void {
    if (this.props.isArchived) {
      return;
    }
    this.props.isArchived = true;
    this.touch();
  }

  public unarchive(): void {
    if (!this.props.isArchived) {
      return;
    }
    this.props.isArchived = false;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Validation ---

  private validateName(name: string): void {
    if (!name || name.trim().length < 1) {
      throw new Error("Guardian relationship type name is required");
    }
    if (name.trim().length > 100) {
      throw new Error(
        "Guardian relationship type name must be at most 100 characters",
      );
    }
  }

  private validateOrder(order: number): void {
    if (order < 0) {
      throw new Error("Order must be a non-negative number");
    }
  }

  // --- Factory Method ---

  public static create(
    props: Optional<
      GuardianRelationshipTypeProps,
      "createdAt" | "updatedAt" | "isArchived" | "description"
    >,
    id?: string,
  ): GuardianRelationshipType {
    if (!props.campusId) {
      throw new Error("Campus ID is required for guardian relationship type");
    }

    if (!props.name || props.name.trim().length < 1) {
      throw new Error("Guardian relationship type name is required");
    }

    if (props.name.trim().length > 100) {
      throw new Error(
        "Guardian relationship type name must be at most 100 characters",
      );
    }

    if (props.order < 0) {
      throw new Error("Order must be a non-negative number");
    }

    const guardianRelationshipTypeProps: GuardianRelationshipTypeProps = {
      ...props,
      name: props.name.trim(),
      description: props.description?.trim() || null,
      isArchived: props.isArchived ?? false,
      order: props.order,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new GuardianRelationshipType(
      guardianRelationshipTypeProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
