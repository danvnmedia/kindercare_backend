import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface StaffTypeProps {
  campusId: string;
  name: string;
  description: string | null;
  defaultRoleId: string | null;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UpdateStaffTypeData = Partial<
  Omit<StaffTypeProps, "campusId" | "createdAt" | "updatedAt">
>;

export class StaffType extends Entity<StaffTypeProps> {
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

  get defaultRoleId(): string | null {
    return this.props.defaultRoleId;
  }

  get isActive(): boolean {
    return this.props.isActive;
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

  public update(data: UpdateStaffTypeData): void {
    if (data.name !== undefined) {
      this.validateName(data.name);
      this.props.name = data.name.trim();
    }

    if (data.description !== undefined) {
      this.props.description = data.description?.trim() || null;
    }

    if (data.defaultRoleId !== undefined) {
      this.props.defaultRoleId = data.defaultRoleId;
    }

    if (data.isActive !== undefined) {
      this.props.isActive = data.isActive;
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

  public activate(): void {
    if (this.props.isActive) {
      return; // Already active
    }
    this.props.isActive = true;
    this.touch();
  }

  public deactivate(): void {
    if (!this.props.isActive) {
      return; // Already inactive
    }
    this.props.isActive = false;
    this.touch();
  }

  public setDefaultRole(roleId: string | null): void {
    this.props.defaultRoleId = roleId;
    this.touch();
  }

  public hasDefaultRole(): boolean {
    return this.props.defaultRoleId !== null;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Validation ---

  private validateName(name: string): void {
    if (!name || name.trim().length < 1) {
      throw new Error("Staff type name is required");
    }
    if (name.trim().length > 100) {
      throw new Error("Staff type name must be at most 100 characters");
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
      StaffTypeProps,
      "createdAt" | "updatedAt" | "isActive" | "description" | "defaultRoleId"
    >,
    id?: string,
  ): StaffType {
    // Validation
    if (!props.campusId) {
      throw new Error("Campus ID is required for staff type");
    }

    if (!props.name || props.name.trim().length < 1) {
      throw new Error("Staff type name is required");
    }

    if (props.name.trim().length > 100) {
      throw new Error("Staff type name must be at most 100 characters");
    }

    if (props.order < 0) {
      throw new Error("Order must be a non-negative number");
    }

    const staffTypeProps: StaffTypeProps = {
      ...props,
      name: props.name.trim(),
      description: props.description?.trim() || null,
      defaultRoleId: props.defaultRoleId ?? null,
      isActive: props.isActive ?? true,
      order: props.order,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new StaffType(
      staffTypeProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
