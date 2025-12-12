import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface FileProps {
  key: string;
  filename: string;
  mimeType: string;
  size: bigint;
  status: "PENDING" | "ACTIVE" | "DELETED";
  uploadedBy: UniqueEntityID;
  createdAt: Date;
  updatedAt: Date;
}

export class File extends Entity<FileProps> {
  protected props: FileProps; // Define props here

  private constructor(props: FileProps, id?: UniqueEntityID) {
    super(id); // Pass only id to super
    this.props = props;
  }

  get key() {
    return this.props.key;
  }

  get filename() {
    return this.props.filename;
  }

  get mimeType() {
    return this.props.mimeType;
  }

  get size() {
    return this.props.size;
  }

  get status() {
    return this.props.status;
  }

  get uploadedBy() {
    return this.props.uploadedBy;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  static create(
    props: Optional<FileProps, "createdAt" | "updatedAt" | "status">,
    id?: UniqueEntityID,
  ) {
    const file = new File(
      {
        ...props,
        status: props.status ?? "PENDING",
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id,
    );

    return file;
  }
}
