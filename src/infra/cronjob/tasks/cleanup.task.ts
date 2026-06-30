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
    this.logger.log("Starting cleanup task...");

    try {
      const result = await this.cleanupStalePendingUploadsUseCase.execute();

      this.logger.log(
        `Cleanup task completed successfully: stalePending=${result.scanned}, markedError=${result.markedError}, objectsDeleted=${result.objectsDeleted}`,
      );
    } catch (error) {
      this.logger.error("Cleanup task failed", error);
    }
  }

  @Cron("0 0 * * *") // Daily at midnight
  async handleDailyCleanup() {
    this.logger.log("Starting daily cleanup task...");

    try {
      const result = await this.cleanupStalePendingUploadsUseCase.execute({
        olderThanMs: 24 * 60 * 60 * 1000,
        limit: 500,
      });

      this.logger.log(
        `Daily cleanup task completed successfully: stalePending=${result.scanned}, markedError=${result.markedError}, objectsDeleted=${result.objectsDeleted}`,
      );
    } catch (error) {
      this.logger.error("Daily cleanup task failed", error);
    }
  }
}
