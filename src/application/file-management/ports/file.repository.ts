import { File } from "../../../domain/file-management/entities/file.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";

export type SoftDeleteFileResult = "DELETED" | "ATTACHED" | "NOT_FOUND";

export abstract class FileRepository {
  abstract create(file: File): Promise<File>;
  abstract update(file: File): Promise<File>;
  abstract findById(id: string): Promise<File | null>;
  abstract findByIds(ids: string[]): Promise<File[]>;

  /**
   * Hard delete a file record from database.
   * For soft delete, use update() with file.markAsDeleted()
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Find file by ID within a specific campus (campus-scoped access verification)
   * Note: Excludes soft-deleted files by default
   */
  abstract findByIdAndCampus(
    id: string,
    campusId: string,
  ): Promise<File | null>;

  /**
   * Find all files for a campus with filtering, sorting, pagination
   * Note: Excludes soft-deleted files by default
   */
  abstract findByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<File>>;

  /**
   * Check if file exists in a specific campus
   * Note: Excludes soft-deleted files by default
   */
  abstract existsByIdAndCampus(id: string, campusId: string): Promise<boolean>;

  /**
   * Find file by key (S3 path)
   * Note: Excludes soft-deleted files by default
   */
  abstract findByKey(key: string): Promise<File | null>;

  /**
   * Find stale PENDING uploads and stale ERROR cleanup retries.
   */
  abstract findCleanupCandidates(cutoff: Date, limit: number): Promise<File[]>;

  /**
   * Atomically transition a non-deleted file from the expected status.
   * Returns false when another worker won the claim.
   */
  abstract transitionStatus(
    id: string,
    expectedStatus: FileStatus,
    nextStatus: FileStatus,
  ): Promise<boolean>;

  /**
   * Atomically claim a stale PENDING or ERROR file for cleanup.
   * Refreshing updatedAt acts as a retry lease between workers.
   */
  abstract claimStaleForCleanup(
    id: string,
    expectedStatus: FileStatus,
    cutoff: Date,
  ): Promise<Date | null>;

  /**
   * Mark a successfully cleaned ERROR file as soft-deleted only while the
   * caller still owns the exact cleanup lease.
   */
  abstract completeCleanup(id: string, leaseToken: Date): Promise<boolean>;

  /**
   * Soft-delete a file under a row lock only when no attachment references it.
   */
  abstract softDeleteIfUnattached(
    id: string,
    campusId: string,
  ): Promise<SoftDeleteFileResult>;
}
