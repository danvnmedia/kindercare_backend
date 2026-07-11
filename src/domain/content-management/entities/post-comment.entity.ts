import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { User } from "@/domain/user-management/user.entity";

/**
 * Maximum nesting depth for comments.
 * Comments can be nested up to 3 levels (0, 1, 2).
 */
export const MAX_COMMENT_DEPTH = 3;

/**
 * Maximum length for comment content.
 */
export const MAX_COMMENT_LENGTH = 1000;

export enum PostCommentType {
  PUBLIC = "PUBLIC",
  MANAGEMENT = "MANAGEMENT",
}

/**
 * Properties of the PostComment entity.
 * Comments support nesting via parentCommentId and depth tracking.
 */
export interface PostCommentProps {
  postId: string;
  userId: string;
  user?: User;
  parentCommentId: string | null;
  depth: number;
  content: string;
  commentType: PostCommentType;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * PostComment entity represents a comment on a post.
 * Supports nested comments up to MAX_COMMENT_DEPTH levels.
 * Uses soft delete to preserve comment threads for audit.
 */
export class PostComment extends Entity<PostCommentProps> {
  // --- Getters ---

  get postId(): string {
    return this.props.postId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get user(): User | undefined {
    return this.props.user;
  }

  get parentCommentId(): string | null {
    return this.props.parentCommentId;
  }

  get depth(): number {
    return this.props.depth;
  }

  get content(): string {
    return this.props.content;
  }

  get commentType(): PostCommentType {
    return this.props.commentType;
  }

  get isDeleted(): boolean {
    return this.props.isDeleted;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get deletedById(): string | null {
    return this.props.deletedById;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  /**
   * Updates the comment content.
   * Cannot update if comment is deleted.
   * @param content - The new content.
   */
  public updateContent(content: string): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot update a deleted comment");
    }

    if (!content || content.trim().length === 0) {
      throw new Error("Comment content cannot be empty");
    }

    if (content.length > MAX_COMMENT_LENGTH) {
      throw new Error(
        `Comment content cannot exceed ${MAX_COMMENT_LENGTH} characters`,
      );
    }

    this.props.content = content.trim();
    this.touch();
  }

  /**
   * Soft deletes the comment.
   * Content is preserved for audit but marked as deleted.
   * @param deletedById - The ID of the user who deleted the comment.
   */
  public softDelete(deletedById: string): void {
    if (this.props.isDeleted) {
      return; // Already deleted
    }

    if (!deletedById) {
      throw new Error("Deleter ID is required");
    }

    this.props.isDeleted = true;
    this.props.deletedAt = new Date();
    this.props.deletedById = deletedById;
    this.touch();
  }

  /**
   * Checks if this comment can receive replies.
   * Replies are allowed if the comment is not deleted and not at max depth.
   * @returns True if replies are allowed.
   */
  public canReply(): boolean {
    return !this.props.isDeleted && this.props.depth < MAX_COMMENT_DEPTH - 1;
  }

  /**
   * Checks if this is a root-level comment (no parent).
   * @returns True if this is a root comment.
   */
  public isRootComment(): boolean {
    return this.props.parentCommentId === null;
  }

  /**
   * Updates the 'updatedAt' timestamp.
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  /**
   * Creates a new PostComment entity.
   * @param props - The properties of the comment.
   * @param id - An optional ID.
   * @returns A new PostComment instance.
   */
  public static create(
    props: Optional<
      PostCommentProps,
      | "createdAt"
      | "updatedAt"
      | "isDeleted"
      | "deletedAt"
      | "deletedById"
      | "parentCommentId"
      | "depth"
      | "user"
      | "commentType"
    >,
    id?: string,
  ): PostComment {
    // Validation
    if (!props.postId) {
      throw new Error("Post ID is required for comment");
    }

    if (!props.userId) {
      throw new Error("User ID is required for comment");
    }

    if (!props.content || props.content.trim().length === 0) {
      throw new Error("Comment content is required");
    }

    if (props.content.length > MAX_COMMENT_LENGTH) {
      throw new Error(
        `Comment content cannot exceed ${MAX_COMMENT_LENGTH} characters`,
      );
    }

    const depth = props.depth ?? 0;
    if (depth < 0 || depth >= MAX_COMMENT_DEPTH) {
      throw new Error(
        `Comment depth must be between 0 and ${MAX_COMMENT_DEPTH - 1}`,
      );
    }

    // If parentCommentId is provided, depth should be > 0
    if (props.parentCommentId && depth === 0) {
      throw new Error("Reply comments must have depth > 0");
    }

    // If no parentCommentId, depth should be 0
    if (!props.parentCommentId && depth !== 0) {
      throw new Error("Root comments must have depth 0");
    }

    const commentProps: PostCommentProps = {
      postId: props.postId,
      userId: props.userId,
      user: props.user,
      parentCommentId: props.parentCommentId ?? null,
      depth,
      content: props.content.trim(),
      commentType: props.commentType ?? PostCommentType.PUBLIC,
      isDeleted: props.isDeleted ?? false,
      deletedAt: props.deletedAt ?? null,
      deletedById: props.deletedById ?? null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new PostComment(
      commentProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
