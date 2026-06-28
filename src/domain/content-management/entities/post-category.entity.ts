import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

/**
 * Properties of the PostCategory entity.
 * Categories are campus-scoped and used to organize posts.
 */
export interface PostCategoryProps {
  campusId: string;
  name: string;
  color: string;
  icon: string | null;
  order: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data for updating a post category.
 */
export type UpdatePostCategoryData = Partial<
  Pick<PostCategoryProps, "name" | "color" | "icon" | "order">
>;

/**
 * PostCategory entity represents a category for organizing posts within a campus.
 * Categories have a name, color, optional icon, and a display order.
 */
export class PostCategory extends Entity<PostCategoryProps> {
  // --- Getters ---

  get campusId(): string {
    return this.props.campusId;
  }

  get name(): string {
    return this.props.name;
  }

  get color(): string {
    return this.props.color;
  }

  get icon(): string | null {
    return this.props.icon;
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

  // --- Domain Methods ---

  /**
   * Updates the category information.
   * @param data - The data to update.
   */
  public updateInfo(data: UpdatePostCategoryData): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error("Category name cannot be empty");
      }
      if (data.name.length > 100) {
        throw new Error("Category name cannot exceed 100 characters");
      }
      this.props.name = data.name.trim();
    }

    if (data.color !== undefined) {
      if (!data.color || !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
        throw new Error("Color must be a valid hex color (e.g., #FF5733)");
      }
      this.props.color = data.color.toUpperCase();
    }

    if (data.icon !== undefined) {
      this.props.icon = data.icon;
    }

    if (data.order !== undefined) {
      if (data.order < 0) {
        throw new Error("Order must be a non-negative number");
      }
      this.props.order = data.order;
    }

    this.touch();
  }

  /**
   * Archives the category, hiding it from selection.
   * Existing posts with this category remain associated.
   */
  public archive(): void {
    if (this.props.isArchived) {
      return; // Already archived
    }
    this.props.isArchived = true;
    this.touch();
  }

  /**
   * Unarchives the category, making it visible for selection.
   */
  public unarchive(): void {
    if (!this.props.isArchived) {
      return; // Already not archived
    }
    this.props.isArchived = false;
    this.touch();
  }

  /**
   * Updates the 'updatedAt' timestamp.
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  /**
   * Creates a new PostCategory entity.
   * @param props - The properties of the category.
   * @param id - An optional ID.
   * @returns A new PostCategory instance.
   */
  public static create(
    props: Optional<
      PostCategoryProps,
      "createdAt" | "updatedAt" | "isArchived" | "icon" | "order"
    >,
    id?: string,
  ): PostCategory {
    // Validation
    if (!props.campusId) {
      throw new Error("Campus ID is required for category");
    }

    if (!props.name || props.name.trim().length === 0) {
      throw new Error("Category name is required");
    }

    if (props.name.length > 100) {
      throw new Error("Category name cannot exceed 100 characters");
    }

    if (!props.color || !/^#[0-9A-Fa-f]{6}$/.test(props.color)) {
      throw new Error("Color must be a valid hex color (e.g., #FF5733)");
    }

    if (props.order !== undefined && props.order < 0) {
      throw new Error("Order must be a non-negative number");
    }

    const categoryProps: PostCategoryProps = {
      campusId: props.campusId,
      name: props.name.trim(),
      color: props.color.toUpperCase(),
      icon: props.icon ?? null,
      order: props.order ?? 0,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new PostCategory(
      categoryProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
