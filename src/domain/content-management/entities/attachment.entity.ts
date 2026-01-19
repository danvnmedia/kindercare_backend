import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { File } from "@/domain/file-management/entities/file.entity";

export interface AttachmentProps {
  postId: string;
  fileId: string;
  comment?: string | null;
  order: number;
  /** The related file entity - populated when fetched with relations */
  file?: File | null;
  createdAt: Date;
  updatedAt?: Date | null;
}

export class Attachment extends Entity<AttachmentProps> {
  get postId(): string {
    return this.props.postId;
  }

  get fileId(): string {
    return this.props.fileId;
  }

  get comment(): string | null | undefined {
    return this.props.comment;
  }

  get order(): number {
    return this.props.order;
  }

  get file(): File | null | undefined {
    return this.props.file;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null | undefined {
    return this.props.updatedAt;
  }

  static create(
    props: Optional<
      AttachmentProps,
      "createdAt" | "updatedAt" | "comment" | "file"
    >,
    id?: string,
  ): Attachment {
    return new Attachment(
      {
        ...props,
        comment: props.comment ?? null,
        file: props.file ?? null,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? null,
      },
      new UniqueEntityID(id),
    );
  }
}
