import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class CleanupTask {
  private readonly logger = new Logger(CleanupTask.name);

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    this.logger.log("Starting cleanup task...");

    try {
      // Simulate cleanup operations
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.logger.log("Cleanup task completed successfully");
    } catch (error) {
      this.logger.error("Cleanup task failed", error);
    }
  }

  @Cron("0 0 * * *") // Daily at midnight
  async handleDailyCleanup() {
    this.logger.log("Starting daily cleanup task...");

    try {
      // Simulate daily cleanup operations
      await new Promise((resolve) => setTimeout(resolve, 5000));

      this.logger.log("Daily cleanup task completed successfully");
    } catch (error) {
      this.logger.error("Daily cleanup task failed", error);
    }
  }
}
