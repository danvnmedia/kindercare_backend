import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { PostStatus } from "../enums/post-status.enum";
import { PostAudience } from "./post-audience.entity";
import { Attachment } from "./attachment.entity";
import { User } from "@/domain/user-management/user.entity";

export interface PostProps {
  authorId: string;
  author?: User;
  title: string;
  content: string | null;
  status: PostStatus;
  publishAt: Date | null;
  audiences: PostAudience[];
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

export class Post extends Entity<PostProps> {
  // --- Getters ---

  get authorId(): string {
    return this.props.authorId;
  }

  get author(): User | undefined {
    return this.props.author;
  }

  get title(): string {
    return this.props.title;
  }

  get content(): string | null {
    return this.props.content;
  }

  get status(): PostStatus {
    return this.props.status;
  }

  get publishAt(): Date | null {
    return this.props.publishAt;
  }

  get audiences(): PostAudience[] {
    return this.props.audiences;
  }

  get attachments(): Attachment[] {
    return this.props.attachments;
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
    if (title.length > 500) {
      throw new Error("Post title cannot exceed 500 characters");
    }
    this.props.title = title.trim();
    this.touch();
  }

  /**
   * Update post content
   */
  public updateContent(content: string | null): void {
    this.props.content = content;
    this.touch();
  }

  /**
   * Publish the post
   * Only draft posts can be published
   */
  public publish(publishAt?: Date): void {
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
    this.props.status = PostStatus.ARCHIVED;
    this.touch();
  }

  /**
   * Move post to draft status
   */
  public moveToDraft(): void {
    this.props.status = PostStatus.DRAFT;
    this.props.publishAt = null;
    this.touch();
  }

  /**
   * Submit post for review
   * Only draft posts can be submitted for review
   */
  public submitForReview(): void {
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
      | "content"
      | "publishAt"
    >,
    id?: string,
  ): Post {
    // Validation
    if (!props.title || props.title.trim().length === 0) {
      throw new Error("Post title is required");
    }
    if (!props.authorId) {
      throw new Error("Post must have an author");
    }

    return new Post(
      {
        authorId: props.authorId,
        author: props.author,
        title: props.title,
        content: props.content ?? null,
        publishAt: props.publishAt ?? null,
        status: props.status ?? PostStatus.DRAFT,
        audiences: props.audiences ?? [],
        attachments: props.attachments ?? [],
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
