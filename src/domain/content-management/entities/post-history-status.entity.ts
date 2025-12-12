import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { PostStatus } from "../enums/post-status.enum";
import { Optional } from "@/core/types/optional";

export interface PostHistoryStatusProps {
  postId: UniqueEntityID;
  userId: UniqueEntityID;
  status: PostStatus;
  comment?: string | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export class PostHistoryStatus extends Entity<PostHistoryStatusProps> {
  protected props: PostHistoryStatusProps;

  private constructor(props: PostHistoryStatusProps, id?: UniqueEntityID) {
    super(id);
    this.props = props;
  }

  get postId(): UniqueEntityID {
    return this.props.postId;
  }

  get userId(): UniqueEntityID {
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
    id?: UniqueEntityID,
  ): PostHistoryStatus {
    const postHistoryStatusProps: PostHistoryStatusProps = {
      ...props,
      comment: props.comment ?? null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? null,
    };
    const postHistoryStatus = new PostHistoryStatus(postHistoryStatusProps, id);
    return postHistoryStatus;
  }
}
