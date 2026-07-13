import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { ExpireInactiveSchoolYearLifecycleRunsUseCase } from "@/application/class-management/use-cases/school-year-lifecycle";

@Injectable()
export class SchoolYearLifecycleExpirationTask {
  private readonly logger = new Logger(SchoolYearLifecycleExpirationTask.name);

  constructor(
    private readonly expireInactiveRuns: ExpireInactiveSchoolYearLifecycleRunsUseCase,
  ) {}

  @Cron("0 15 1 * * *")
  async execute(): Promise<void> {
    try {
      const result = await this.expireInactiveRuns.execute();
      this.logger.log(
        `Lifecycle expiration scanned=${result.scannedCount} expired=${result.expiredCount} skipped=${result.skippedCount}`,
      );
    } catch (error) {
      this.logger.error("School-year lifecycle expiration failed", error);
    }
  }
}
