import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { PostStatus } from "../enums/post-status.enum";
import { Optional } from "@/core/types/optional";

export interface PostHistoryStatusProps {
  postId: string;
  changedById: string;
  previousStatus?: PostStatus | null;
  newStatus: PostStatus;
  reason?: string | null;
  createdAt: Date;
}

export class PostHistoryStatus extends Entity<PostHistoryStatusProps> {
  get postId(): string {
    return this.props.postId;
  }

  get changedById(): string {
    return this.props.changedById;
  }

  get previousStatus(): PostStatus | null | undefined {
    return this.props.previousStatus;
  }

  get newStatus(): PostStatus {
    return this.props.newStatus;
  }

  get reason(): string | null | undefined {
    return this.props.reason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(
    props: Optional<
      PostHistoryStatusProps,
      "createdAt" | "previousStatus" | "reason"
    >,
    id?: string,
  ): PostHistoryStatus {
    return new PostHistoryStatus(
      {
        ...props,
        previousStatus: props.previousStatus ?? null,
        reason: props.reason ?? null,
        createdAt: props.createdAt ?? new Date(),
      },
      new UniqueEntityID(id),
    );
  }
}
