import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

/**
 * Default maximum number of pinned posts per campus.
 */
export const DEFAULT_MAX_PINNED_POSTS = 3;

/**
 * Properties of the CampusSetting entity.
 * Stores campus-level configuration for the content management system.
 */
export interface CampusSettingProps {
  campusId: string;
  requireTeacherApproval: boolean;
  maxPinnedPosts: number;
  allowParentComments: boolean;
  allowReactions: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data for updating campus settings.
 */
export type UpdateCampusSettingData = Partial<
  Pick<
    CampusSettingProps,
    | "requireTeacherApproval"
    | "maxPinnedPosts"
    | "allowParentComments"
    | "allowReactions"
  >
>;

/**
 * CampusSetting entity stores configuration options for a campus's content management.
 * Each campus has exactly one settings record.
 */
export class CampusSetting extends Entity<CampusSettingProps> {
  // --- Getters ---

  get campusId(): string {
    return this.props.campusId;
  }

  get requireTeacherApproval(): boolean {
    return this.props.requireTeacherApproval;
  }

  get maxPinnedPosts(): number {
    return this.props.maxPinnedPosts;
  }

  get allowParentComments(): boolean {
    return this.props.allowParentComments;
  }

  get allowReactions(): boolean {
    return this.props.allowReactions;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  /**
   * Updates the campus settings.
   * @param data - The settings to update.
   */
  public update(data: UpdateCampusSettingData): void {
    if (data.requireTeacherApproval !== undefined) {
      this.props.requireTeacherApproval = data.requireTeacherApproval;
    }

    if (data.maxPinnedPosts !== undefined) {
      if (data.maxPinnedPosts < 0) {
        throw new Error("Maximum pinned posts cannot be negative");
      }
      if (data.maxPinnedPosts > 10) {
        throw new Error("Maximum pinned posts cannot exceed 10");
      }
      this.props.maxPinnedPosts = data.maxPinnedPosts;
    }

    if (data.allowParentComments !== undefined) {
      this.props.allowParentComments = data.allowParentComments;
    }

    if (data.allowReactions !== undefined) {
      this.props.allowReactions = data.allowReactions;
    }

    this.touch();
  }

  /**
   * Enables teacher approval requirement.
   */
  public enableTeacherApproval(): void {
    if (this.props.requireTeacherApproval) {
      return; // Already enabled
    }
    this.props.requireTeacherApproval = true;
    this.touch();
  }

  /**
   * Disables teacher approval requirement.
   */
  public disableTeacherApproval(): void {
    if (!this.props.requireTeacherApproval) {
      return; // Already disabled
    }
    this.props.requireTeacherApproval = false;
    this.touch();
  }

  /**
   * Enables parent comments on posts.
   */
  public enableParentComments(): void {
    if (this.props.allowParentComments) {
      return; // Already enabled
    }
    this.props.allowParentComments = true;
    this.touch();
  }

  /**
   * Disables parent comments on posts.
   */
  public disableParentComments(): void {
    if (!this.props.allowParentComments) {
      return; // Already disabled
    }
    this.props.allowParentComments = false;
    this.touch();
  }

  /**
   * Enables reactions on posts.
   */
  public enableReactions(): void {
    if (this.props.allowReactions) {
      return; // Already enabled
    }
    this.props.allowReactions = true;
    this.touch();
  }

  /**
   * Disables reactions on posts.
   */
  public disableReactions(): void {
    if (!this.props.allowReactions) {
      return; // Already disabled
    }
    this.props.allowReactions = false;
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
   * Creates a new CampusSetting entity.
   * @param props - The properties of the campus setting.
   * @param id - An optional ID.
   * @returns A new CampusSetting instance.
   */
  public static create(
    props: Optional<
      CampusSettingProps,
      | "createdAt"
      | "updatedAt"
      | "requireTeacherApproval"
      | "maxPinnedPosts"
      | "allowParentComments"
      | "allowReactions"
    >,
    id?: string,
  ): CampusSetting {
    // Validation
    if (!props.campusId) {
      throw new Error("Campus ID is required for campus setting");
    }

    if (props.maxPinnedPosts !== undefined) {
      if (props.maxPinnedPosts < 0) {
        throw new Error("Maximum pinned posts cannot be negative");
      }
      if (props.maxPinnedPosts > 10) {
        throw new Error("Maximum pinned posts cannot exceed 10");
      }
    }

    const settingProps: CampusSettingProps = {
      campusId: props.campusId,
      requireTeacherApproval: props.requireTeacherApproval ?? true,
      maxPinnedPosts: props.maxPinnedPosts ?? DEFAULT_MAX_PINNED_POSTS,
      allowParentComments: props.allowParentComments ?? true,
      allowReactions: props.allowReactions ?? true,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new CampusSetting(
      settingProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
