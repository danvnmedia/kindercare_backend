import { File } from "../../../domain/file-management/entities/file.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

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
   * Find pending files older than cutoff for upload cleanup.
   */
  abstract findStalePending(cutoff: Date, limit: number): Promise<File[]>;
}
