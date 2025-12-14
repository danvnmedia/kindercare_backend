import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { PostStatus } from "../enums/post-status.enum";
import { Optional } from "@/core/types/optional";

export interface PostHistoryStatusProps {
  postId: string;
  userId: string;
  status: PostStatus;
  comment?: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export class PostHistoryStatus extends Entity<PostHistoryStatusProps> {
  get postId(): string {
    return this.props.postId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get status(): PostStatus {
    return this.props.status;
  }

  get comment(): string | null | undefined {
    return this.props.comment;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null | undefined {
    return this.props.updatedAt;
  }

  static create(
    props: Optional<
      PostHistoryStatusProps,
      "createdAt" | "updatedAt" | "comment"
    >,
    id?: string,
  ): PostHistoryStatus {
    return new PostHistoryStatus(
      {
        ...props,
        comment: props.comment ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? null,
      },
      new UniqueEntityID(id),
    );
  }
}
