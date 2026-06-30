import { Injectable, Logger } from "@nestjs/common";
import { FileRepository } from "../ports/file.repository";
import { StorageService } from "../ports/storage.service";

export interface CleanupStalePendingUploadsRequest {
  olderThanMs?: number;
  limit?: number;
}

export interface CleanupStalePendingUploadsResult {
  scanned: number;
  markedError: number;
  objectsDeleted: number;
  objectDeleteFailures: number;
}

const DEFAULT_STALE_PENDING_UPLOAD_AGE_MS = 60 * 60 * 1000;
const DEFAULT_STALE_PENDING_UPLOAD_LIMIT = 100;

@Injectable()
export class CleanupStalePendingUploadsUseCase {
  private readonly logger = new Logger(CleanupStalePendingUploadsUseCase.name);

  constructor(
    private readonly fileRepository: FileRepository,
    private readonly storageService: StorageService,
  ) {}

  async execute(
    request: CleanupStalePendingUploadsRequest = {},
  ): Promise<CleanupStalePendingUploadsResult> {
    const olderThanMs =
      request.olderThanMs ?? DEFAULT_STALE_PENDING_UPLOAD_AGE_MS;
    const limit = request.limit ?? DEFAULT_STALE_PENDING_UPLOAD_LIMIT;
    const cutoff = new Date(Date.now() - olderThanMs);
    const staleFiles = await this.fileRepository.findStalePending(
      cutoff,
      limit,
    );

    let objectsDeleted = 0;
    let objectDeleteFailures = 0;
    let markedError = 0;

    for (const file of staleFiles) {
      try {
        const metadata = await this.storageService.getObjectMetadata(file.key);
        if (metadata.exists) {
          await this.storageService.delete(file.key);
          objectsDeleted += 1;
        }
      } catch (error) {
        objectDeleteFailures += 1;
        this.logger.warn(
          `Failed to delete stale pending upload object ${file.key}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      file.markAsError();
      await this.fileRepository.update(file);
      markedError += 1;
    }

    if (staleFiles.length > 0) {
      this.logger.log(
        `Cleaned stale pending uploads: scanned=${staleFiles.length}, markedError=${markedError}, objectsDeleted=${objectsDeleted}, objectDeleteFailures=${objectDeleteFailures}`,
      );
    }

    return {
      scanned: staleFiles.length,
      markedError,
      objectsDeleted,
      objectDeleteFailures,
    };
  }
}
