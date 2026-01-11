import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface FileProps {
  key: string;
  filename: string;
  mimeType: string;
  size: bigint;
  status: "PENDING" | "ACTIVE" | "DELETED";
  uploadedBy: string;
  campusId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class File extends Entity<FileProps> {
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

  get campusId() {
    return this.props.campusId;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  // Domain methods
  public markAsActive(): void {
    if (this.props.status === "DELETED") {
      throw new Error("Cannot activate a deleted file");
    }
    this.props.status = "ACTIVE";
    this.touch();
  }

  public markAsDeleted(): void {
    this.props.status = "DELETED";
    this.touch();
  }

  public isDeleted(): boolean {
    return this.props.status === "DELETED";
  }

  public isPending(): boolean {
    return this.props.status === "PENDING";
  }

  public isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  /**
   * Update the 'updatedAt' timestamp
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  static create(
    props: Optional<FileProps, "createdAt" | "updatedAt" | "status">,
    id?: string,
  ) {
    return new File(
      {
        ...props,
        status: props.status ?? "PENDING",
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      new UniqueEntityID(id),
    );
  }
}
