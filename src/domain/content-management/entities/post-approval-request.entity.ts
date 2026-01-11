import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { ApprovalStatus } from "../enums/approval-status.enum";

/**
 * Properties of the PostApprovalRequest entity.
 * Tracks approval submissions with content snapshots for audit.
 */
export interface PostApprovalRequestProps {
  postId: string;
  submittedById: string;
  submittedAt: Date;
  status: ApprovalStatus;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  titleSnapshot: string;
  contentSnapshot: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * PostApprovalRequest entity represents a request for admin approval of a post.
 * Contains a snapshot of the post content at submission time for audit purposes.
 */
export class PostApprovalRequest extends Entity<PostApprovalRequestProps> {
  // --- Getters ---

  get postId(): string {
    return this.props.postId;
  }

  get submittedById(): string {
    return this.props.submittedById;
  }

  get submittedAt(): Date {
    return this.props.submittedAt;
  }

  get status(): ApprovalStatus {
    return this.props.status;
  }

  get reviewedById(): string | null {
    return this.props.reviewedById;
  }

  get reviewedAt(): Date | null {
    return this.props.reviewedAt;
  }

  get reviewNote(): string | null {
    return this.props.reviewNote;
  }

  get titleSnapshot(): string {
    return this.props.titleSnapshot;
  }

  get contentSnapshot(): Record<string, unknown> | null {
    return this.props.contentSnapshot;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // --- Domain Methods ---

  /**
   * Checks if the request is pending review.
   */
  public isPending(): boolean {
    return this.props.status === ApprovalStatus.PENDING;
  }

  /**
   * Checks if the request has been approved.
   */
  public isApproved(): boolean {
    return this.props.status === ApprovalStatus.APPROVED;
  }

  /**
   * Checks if the request has been rejected.
   */
  public isRejected(): boolean {
    return this.props.status === ApprovalStatus.REJECTED;
  }

  /**
   * Approves the approval request.
   * @param reviewerId - The ID of the admin reviewing the request.
   * @param note - Optional note about the approval.
   */
  public approve(reviewerId: string, note?: string): void {
    if (!this.isPending()) {
      throw new Error("Only pending requests can be approved");
    }

    if (!reviewerId) {
      throw new Error("Reviewer ID is required");
    }

    this.props.status = ApprovalStatus.APPROVED;
    this.props.reviewedById = reviewerId;
    this.props.reviewedAt = new Date();
    this.props.reviewNote = note?.trim() || null;
  }

  /**
   * Rejects the approval request.
   * @param reviewerId - The ID of the admin reviewing the request.
   * @param note - Optional note explaining the rejection reason.
   */
  public reject(reviewerId: string, note?: string): void {
    if (!this.isPending()) {
      throw new Error("Only pending requests can be rejected");
    }

    if (!reviewerId) {
      throw new Error("Reviewer ID is required");
    }

    this.props.status = ApprovalStatus.REJECTED;
    this.props.reviewedById = reviewerId;
    this.props.reviewedAt = new Date();
    this.props.reviewNote = note?.trim() || null;
  }

  // --- Factory Method ---

  /**
   * Creates a new PostApprovalRequest entity.
   * @param props - The properties of the approval request.
   * @param id - An optional ID.
   * @returns A new PostApprovalRequest instance.
   */
  public static create(
    props: Optional<
      PostApprovalRequestProps,
      | "createdAt"
      | "submittedAt"
      | "status"
      | "reviewedById"
      | "reviewedAt"
      | "reviewNote"
      | "contentSnapshot"
    >,
    id?: string,
  ): PostApprovalRequest {
    // Validation
    if (!props.postId) {
      throw new Error("Post ID is required for approval request");
    }

    if (!props.submittedById) {
      throw new Error("Submitter ID is required for approval request");
    }

    if (!props.titleSnapshot || props.titleSnapshot.trim().length === 0) {
      throw new Error("Title snapshot is required for approval request");
    }

    const now = new Date();
    const requestProps: PostApprovalRequestProps = {
      postId: props.postId,
      submittedById: props.submittedById,
      submittedAt: props.submittedAt ?? now,
      status: props.status ?? ApprovalStatus.PENDING,
      reviewedById: props.reviewedById ?? null,
      reviewedAt: props.reviewedAt ?? null,
      reviewNote: props.reviewNote ?? null,
      titleSnapshot: props.titleSnapshot.trim(),
      contentSnapshot: props.contentSnapshot ?? null,
      createdAt: props.createdAt ?? now,
    };

    return new PostApprovalRequest(
      requestProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
