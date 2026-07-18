import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CleanupStalePendingUploadsUseCase } from "@/application/file-management/use-cases/cleanup-stale-pending-uploads.use-case";

@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  constructor(
    private readonly cleanupStalePendingUploadsUseCase: CleanupStalePendingUploadsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    if (process.env.ENABLE_IN_PROCESS_CRON !== "true") {
      return;
    }

    return this.runCleanup();
  }

  async runCleanup() {
    this.logger.log("Starting cleanup task...");

    try {
      const result = await this.cleanupStalePendingUploadsUseCase.execute();

      this.logger.log(
        `Cleanup task completed: candidates=${result.scanned}, markedError=${result.markedError}, objectsDeleted=${result.objectsDeleted}, cleanupFinalized=${result.cleanupFinalized}, finalizationConflicts=${result.finalizationConflicts}, finalizationFailures=${result.finalizationFailures}`,
      );
    } catch (error) {
      this.logger.error("Cleanup task failed", error);
      throw error;
    }
  }

  @Cron("0 0 * * *") // Daily at midnight
  async handleDailyCleanup() {
    if (process.env.ENABLE_IN_PROCESS_CRON !== "true") {
      return;
    }

    return this.runDailyCleanup();
  }

  async runDailyCleanup() {
    this.logger.log("Starting daily cleanup task...");

    try {
      const result = await this.cleanupStalePendingUploadsUseCase.execute({
        olderThanMs: 24 * 60 * 60 * 1000,
        limit: 500,
      });

      this.logger.log(
        `Daily cleanup task completed: candidates=${result.scanned}, markedError=${result.markedError}, objectsDeleted=${result.objectsDeleted}, cleanupFinalized=${result.cleanupFinalized}, finalizationConflicts=${result.finalizationConflicts}, finalizationFailures=${result.finalizationFailures}`,
      );
    } catch (error) {
      this.logger.error("Daily cleanup task failed", error);
      throw error;
    }
  }
}
