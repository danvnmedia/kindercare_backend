import { File } from "../../../domain/file-management/entities/file.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class FileRepository {
  abstract create(file: File): Promise<File>;
  abstract update(file: File): Promise<File>;
  abstract findById(id: string): Promise<File | null>;
  abstract findByIds(ids: string[]): Promise<File[]>;
  abstract delete(id: string): Promise<void>;

  /**
   * Find file by ID within a specific campus (campus-scoped access verification)
   */
  abstract findByIdAndCampus(
    id: string,
    campusId: string,
  ): Promise<File | null>;

  /**
   * Find all files for a campus with filtering, sorting, pagination
   */
  abstract findByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<File>>;

  /**
   * Check if file exists in a specific campus
   */
  abstract existsByIdAndCampus(id: string, campusId: string): Promise<boolean>;
}
