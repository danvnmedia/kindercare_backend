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
  cleanupFinalized: number;
  finalizationConflicts: number;
  finalizationFailures: number;
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
    const staleFiles = await this.fileRepository.findCleanupCandidates(
      cutoff,
      limit,
    );

    let objectsDeleted = 0;
    let objectDeleteFailures = 0;
    let cleanupFinalized = 0;
    let finalizationConflicts = 0;
    let finalizationFailures = 0;
    let markedError = 0;

    for (const candidate of staleFiles) {
      const leaseToken = await this.fileRepository.claimStaleForCleanup(
        candidate.id,
        candidate.status,
        cutoff,
      );
      if (!leaseToken) continue;

      if (candidate.isPending()) {
        candidate.markAsError();
        markedError += 1;
      }

      try {
        const metadata = await this.storageService.getObjectMetadata(
          candidate.key,
        );
        if (metadata.exists) {
          await this.storageService.delete(candidate.key);
          objectsDeleted += 1;
        }
      } catch (error) {
        objectDeleteFailures += 1;
        this.logger.warn(
          `Failed to delete stale upload object ${candidate.key}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        continue;
      }

      try {
        const finalized = await this.fileRepository.completeCleanup(
          candidate.id,
          leaseToken,
        );
        if (!finalized) {
          finalizationConflicts += 1;
          this.logger.warn(
            `Cleanup lease lost before finalizing file ${candidate.id}; storage object deletion result remains recorded separately`,
          );
          continue;
        }
        cleanupFinalized += 1;
      } catch (error) {
        finalizationFailures += 1;
        this.logger.warn(
          `Failed to finalize stale upload cleanup for ${candidate.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    if (staleFiles.length > 0) {
      this.logger.log(
        `Cleaned stale pending uploads: scanned=${staleFiles.length}, markedError=${markedError}, objectsDeleted=${objectsDeleted}, objectDeleteFailures=${objectDeleteFailures}, cleanupFinalized=${cleanupFinalized}, finalizationConflicts=${finalizationConflicts}, finalizationFailures=${finalizationFailures}`,
      );
    }

    return {
      scanned: staleFiles.length,
      markedError,
      objectsDeleted,
      objectDeleteFailures,
      cleanupFinalized,
      finalizationConflicts,
      finalizationFailures,
    };
  }
}
