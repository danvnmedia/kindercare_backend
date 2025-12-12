import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface AttachmentProps {
  postId: UniqueEntityID;
  fileId: UniqueEntityID;
  comment?: string | null;
  order: number;
  createdAt: Date;
  updatedAt?: Date | null;
}

export class Attachment extends Entity<AttachmentProps> {
  protected props: AttachmentProps;

  private constructor(props: AttachmentProps, id?: UniqueEntityID) {
    super(id);
    this.props = props;
  }

  get postId(): UniqueEntityID {
    return this.props.postId;
  }

  get fileId(): UniqueEntityID {
    return this.props.fileId;
  }

  get comment(): string | null | undefined {
    return this.props.comment;
  }

  get order(): number {
    return this.props.order;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null | undefined {
    return this.props.updatedAt;
  }

  static create(
    props: Optional<AttachmentProps, "createdAt" | "updatedAt" | "comment">,
    id?: UniqueEntityID,
  ): Attachment {
    const attachmentProps: AttachmentProps = {
      ...props,
      comment: props.comment ?? null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? null,
    };
    const attachment = new Attachment(attachmentProps, id);
    return attachment;
  }
}
