import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { PostStatus } from "../enums/post-status.enum";
import { PostAudience } from "./post-audience.entity";
import { Attachment } from "./attachment.entity";
import { User } from "@/domain/user-management/user.entity";

/**
 * Maximum length for post title.
 */
export const MAX_POST_TITLE_LENGTH = 200;

/**
 * Content type for rich text content (Tiptap/ProseMirror JSON format).
 */
export type PostContent = Record<string, unknown> | null;

export interface PostCategoryInfo {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface PostProps {
  campusId: string;
  authorId: string;
  author?: User;
  title: string;
  content: PostContent;
  contentText: string | null;
  contentVersion: number;
  status: PostStatus;
  publishAt: Date | null;
  // Pinning
  isPinned: boolean;
  pinnedUntil: Date | null;
  pinnedById: string | null;
  // Approval workflow
  requiresApproval: boolean;
  // Soft delete
  isDeleted: boolean;
  deletedAt: Date | null;
  // Relations
  audiences: PostAudience[];
  attachments: Attachment[];
  categories?: PostCategoryInfo[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data for updating a post.
 */
export type UpdatePostData = Partial<
  Pick<PostProps, "title" | "content" | "contentText" | "publishAt">
>;

export class Post extends Entity<PostProps> {
  // --- Getters ---

  get campusId(): string {
    return this.props.campusId;
  }

  get authorId(): string {
    return this.props.authorId;
  }

  get author(): User | undefined {
    return this.props.author;
  }

  get title(): string {
    return this.props.title;
  }

  get content(): PostContent {
    return this.props.content;
  }

  get contentText(): string | null {
    return this.props.contentText;
  }

  get contentVersion(): number {
    return this.props.contentVersion;
  }

  get status(): PostStatus {
    return this.props.status;
  }

  get publishAt(): Date | null {
    return this.props.publishAt;
  }

  get isPinned(): boolean {
    return this.props.isPinned;
  }

  get pinnedUntil(): Date | null {
    return this.props.pinnedUntil;
  }

  get pinnedById(): string | null {
    return this.props.pinnedById;
  }

  get requiresApproval(): boolean {
    return this.props.requiresApproval;
  }

  get isDeleted(): boolean {
    return this.props.isDeleted;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get audiences(): PostAudience[] {
    return this.props.audiences;
  }

  get attachments(): Attachment[] {
    return this.props.attachments;
  }

  get categories(): PostCategoryInfo[] {
    return this.props.categories ?? [];
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  /**
   * Update post title with validation
   */
  public updateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new Error("Post title cannot be empty");
    }
    if (title.length > MAX_POST_TITLE_LENGTH) {
      throw new Error(
        `Post title cannot exceed ${MAX_POST_TITLE_LENGTH} characters`,
      );
    }
    this.props.title = title.trim();
    this.incrementContentVersion();
    this.touch();
  }

  /**
   * Update post content (JSON format) and optional plain text for search.
   * @param content - The rich text content in JSON format.
   * @param contentText - The plain text version for full-text search.
   */
  public updateContent(
    content: PostContent,
    contentText?: string | null,
  ): void {
    this.props.content = content;
    if (contentText !== undefined) {
      this.props.contentText = contentText;
    }
    this.incrementContentVersion();
    this.touch();
  }

  /**
   * Increments the content version for tracking edits.
   */
  private incrementContentVersion(): void {
    this.props.contentVersion += 1;
  }

  /**
   * Publish the post
   * Only draft posts can be published
   */
  public publish(publishAt?: Date): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot publish a deleted post");
    }
    if (this.props.status !== PostStatus.DRAFT) {
      throw new Error(
        `Cannot publish post with status ${this.props.status}. Only draft posts can be published.`,
      );
    }
    this.props.status = PostStatus.PUBLISHED;
    this.props.publishAt = publishAt ?? new Date();
    this.touch();
  }

  /**
   * Archive the post
   */
  public archive(): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot archive a deleted post");
    }
    this.props.status = PostStatus.ARCHIVED;
    this.touch();
  }

  /**
   * Move post to draft status
   */
  public moveToDraft(): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot move a deleted post to draft");
    }
    this.props.status = PostStatus.DRAFT;
    this.props.publishAt = null;
    this.touch();
  }

  /**
   * Submit post for review
   * Only draft posts can be submitted for review
   */
  public submitForReview(): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot submit a deleted post for review");
    }
    if (this.props.status !== PostStatus.DRAFT) {
      throw new Error("Only draft posts can be submitted for review");
    }
    this.props.status = PostStatus.PENDING_REVIEW;
    this.touch();
  }

  /**
   * Approve post (move from pending to published)
   * Only pending posts can be approved
   */
  public approve(publishAt?: Date): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot approve a deleted post");
    }
    if (this.props.status !== PostStatus.PENDING_REVIEW) {
      throw new Error("Only pending posts can be approved");
    }
    this.props.status = PostStatus.PUBLISHED;
    this.props.publishAt = publishAt ?? new Date();
    this.touch();
  }

  /**
   * Reject post (move from pending back to draft)
   * Only pending posts can be rejected
   */
  public reject(): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot reject a deleted post");
    }
    if (this.props.status !== PostStatus.PENDING_REVIEW) {
      throw new Error("Only pending posts can be rejected");
    }
    this.props.status = PostStatus.DRAFT;
    this.touch();
  }

  /**
   * Update publish date
   */
  public updatePublishDate(publishAt: Date | null): void {
    this.props.publishAt = publishAt;
    this.touch();
  }

  // --- Pinning Methods ---

  /**
   * Pins the post to the top of the feed.
   * @param pinnedById - The ID of the user who pinned the post.
   * @param pinnedUntil - Optional expiration date for the pin.
   */
  public pin(pinnedById: string, pinnedUntil?: Date | null): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot pin a deleted post");
    }
    if (!this.isPublished()) {
      throw new Error("Only published posts can be pinned");
    }
    if (!pinnedById) {
      throw new Error("Pinner ID is required");
    }

    this.props.isPinned = true;
    this.props.pinnedById = pinnedById;
    this.props.pinnedUntil = pinnedUntil ?? null;
    this.touch();
  }

  /**
   * Unpins the post from the top of the feed.
   */
  public unpin(): void {
    if (!this.props.isPinned) {
      return; // Already unpinned
    }

    this.props.isPinned = false;
    this.props.pinnedById = null;
    this.props.pinnedUntil = null;
    this.touch();
  }

  /**
   * Checks if the pin has expired.
   * @returns True if the post is pinned but the pin has expired.
   */
  public isPinExpired(): boolean {
    if (!this.props.isPinned || !this.props.pinnedUntil) {
      return false;
    }
    return this.props.pinnedUntil < new Date();
  }

  // --- Soft Delete Methods ---

  /**
   * Soft deletes the post.
   * Posts are soft deleted to preserve audit trail.
   */
  public softDelete(): void {
    if (this.props.isDeleted) {
      return; // Already deleted
    }

    // Unpin if pinned
    if (this.props.isPinned) {
      this.unpin();
    }

    this.props.isDeleted = true;
    this.props.deletedAt = new Date();
    this.touch();
  }

  /**
   * Restores a soft-deleted post.
   */
  public restore(): void {
    if (!this.props.isDeleted) {
      return; // Not deleted
    }

    this.props.isDeleted = false;
    this.props.deletedAt = null;
    this.touch();
  }

  // --- Audience Management ---

  /**
   * Add audience to post
   */
  public addAudience(audience: PostAudience): void {
    this.props.audiences.push(audience);
    this.touch();
  }

  /**
   * Remove audience from post
   */
  public removeAudience(audienceId: string): void {
    this.props.audiences = this.props.audiences.filter(
      (a) => a.id !== audienceId,
    );
    this.touch();
  }

  /**
   * Set all audiences at once
   */
  public setAudiences(audiences: PostAudience[]): void {
    this.props.audiences = audiences;
    this.touch();
  }

  // --- Attachment Management ---

  /**
   * Add attachment to post
   */
  public addAttachment(attachment: Attachment): void {
    this.props.attachments.push(attachment);
    this.touch();
  }

  /**
   * Remove attachment from post
   */
  public removeAttachment(attachmentId: string): void {
    this.props.attachments = this.props.attachments.filter(
      (a) => a.id !== attachmentId,
    );
    this.touch();
  }

  /**
   * Set all attachments at once
   */
  public setAttachments(attachments: Attachment[]): void {
    this.props.attachments = attachments;
    this.touch();
  }

  // --- Status Checks ---

  /**
   * Check if post is published
   */
  public isPublished(): boolean {
    return this.props.status === PostStatus.PUBLISHED;
  }

  /**
   * Check if post is draft
   */
  public isDraft(): boolean {
    return this.props.status === PostStatus.DRAFT;
  }

  /**
   * Check if post is pending review
   */
  public isPending(): boolean {
    return this.props.status === PostStatus.PENDING_REVIEW;
  }

  /**
   * Check if post is archived
   */
  public isArchived(): boolean {
    return this.props.status === PostStatus.ARCHIVED;
  }

  /**
   * Check if post can be edited.
   * Posts can be edited if they are not deleted.
   */
  public canEdit(): boolean {
    return !this.props.isDeleted;
  }

  /**
   * Check if post can receive reactions/comments.
   * Only published, non-deleted posts can receive engagement.
   */
  public canReceiveEngagement(): boolean {
    return this.isPublished() && !this.props.isDeleted;
  }

  /**
   * Update the 'updatedAt' timestamp
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  /**
   * Creates a new Post entity
   */
  static create(
    props: Optional<
      PostProps,
      | "createdAt"
      | "updatedAt"
      | "status"
      | "audiences"
      | "attachments"
      | "categories"
      | "content"
      | "contentText"
      | "contentVersion"
      | "publishAt"
      | "isPinned"
      | "pinnedUntil"
      | "pinnedById"
      | "isDeleted"
      | "deletedAt"
      | "requiresApproval"
    >,
    id?: string,
  ): Post {
    // Validation
    if (!props.campusId) {
      throw new Error("Campus ID is required for post");
    }
    if (!props.title || props.title.trim().length === 0) {
      throw new Error("Post title is required");
    }
    if (props.title.length > MAX_POST_TITLE_LENGTH) {
      throw new Error(
        `Post title cannot exceed ${MAX_POST_TITLE_LENGTH} characters`,
      );
    }
    if (!props.authorId) {
      throw new Error("Post must have an author");
    }

    return new Post(
      {
        campusId: props.campusId,
        authorId: props.authorId,
        author: props.author,
        title: props.title.trim(),
        content: props.content ?? null,
        contentText: props.contentText ?? null,
        contentVersion: props.contentVersion ?? 1,
        publishAt: props.publishAt ?? null,
        status: props.status ?? PostStatus.DRAFT,
        isPinned: props.isPinned ?? false,
        pinnedUntil: props.pinnedUntil ?? null,
        pinnedById: props.pinnedById ?? null,
        requiresApproval: props.requiresApproval ?? true,
        isDeleted: props.isDeleted ?? false,
        deletedAt: props.deletedAt ?? null,
        audiences: props.audiences ?? [],
        attachments: props.attachments ?? [],
        categories: props.categories ?? [],
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
