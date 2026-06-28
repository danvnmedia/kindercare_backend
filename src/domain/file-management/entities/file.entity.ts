import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { FileStatus } from "../enums/file-status.enum";

export interface FileProps {
  // Storage Details
  key: string;
  bucket: string | null;
  storageProvider: string;

  // File Metadata
  filename: string;
  mimeType: string;
  size: bigint;
  extension: string | null;

  // Lifecycle
  status: FileStatus;
  uploadedBy: string;

  // Campus scoping
  campusId: string;

  // Soft delete
  isDeleted: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export class File extends Entity<FileProps> {
  get key() {
    return this.props.key;
  }

  get bucket() {
    return this.props.bucket;
  }

  get storageProvider() {
    return this.props.storageProvider;
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

  get extension() {
    return this.props.extension;
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

  get isDeleted() {
    return this.props.isDeleted;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  // Status transition methods
  public markAsUploaded(): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot change status of a deleted file");
    }
    if (this.props.status !== FileStatus.PENDING) {
      throw new Error("Only pending files can be marked as uploaded");
    }
    this.props.status = FileStatus.UPLOADED;
    this.touch();
  }

  public markAsProcessed(): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot change status of a deleted file");
    }
    if (this.props.status !== FileStatus.UPLOADED) {
      throw new Error("Only uploaded files can be marked as processed");
    }
    this.props.status = FileStatus.PROCESSED;
    this.touch();
  }

  public markAsError(): void {
    if (this.props.isDeleted) {
      throw new Error("Cannot change status of a deleted file");
    }
    this.props.status = FileStatus.ERROR;
    this.touch();
  }

  // Soft delete method
  public markAsDeleted(): void {
    this.props.isDeleted = true;
    this.touch();
  }

  // Status check methods
  public isPending(): boolean {
    return this.props.status === FileStatus.PENDING;
  }

  public isUploaded(): boolean {
    return this.props.status === FileStatus.UPLOADED;
  }

  public isProcessed(): boolean {
    return this.props.status === FileStatus.PROCESSED;
  }

  public isError(): boolean {
    return this.props.status === FileStatus.ERROR;
  }

  /**
   * Check if the file is available for use (uploaded or processed, and not deleted)
   */
  public isAvailable(): boolean {
    return (
      !this.props.isDeleted &&
      (this.props.status === FileStatus.UPLOADED ||
        this.props.status === FileStatus.PROCESSED)
    );
  }

  /**
   * Update the 'updatedAt' timestamp
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /**
   * Extract extension from filename
   */
  private static extractExtension(filename: string): string | null {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1 || lastDot === filename.length - 1) {
      return null;
    }
    return filename.slice(lastDot + 1).toLowerCase();
  }

  static create(
    props: Optional<
      FileProps,
      | "createdAt"
      | "updatedAt"
      | "status"
      | "bucket"
      | "storageProvider"
      | "extension"
      | "isDeleted"
    >,
    id?: string,
  ) {
    return new File(
      {
        ...props,
        bucket: props.bucket ?? null,
        storageProvider: props.storageProvider ?? "LOCAL",
        extension: props.extension ?? File.extractExtension(props.filename),
        status: props.status ?? FileStatus.PENDING,
        isDeleted: props.isDeleted ?? false,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      new UniqueEntityID(id),
    );
  }
}
