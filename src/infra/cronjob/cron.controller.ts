import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { Public } from "@/infra/http/decorators";
import { CleanupTask } from "./tasks/cleanup.task";
import { MedicationLifecycleReconciliationTask } from "./tasks/medication-lifecycle-reconciliation.task";
import { SchoolYearLifecycleExpirationTask } from "./tasks/school-year-lifecycle-expiration.task";

@Public()
@Controller("internal/cron")
export class CronController {
  constructor(
    private readonly cleanupTask: CleanupTask,
    private readonly medicationLifecycleTask: MedicationLifecycleReconciliationTask,
    private readonly schoolYearLifecycleTask: SchoolYearLifecycleExpirationTask,
  ) {}

  @Get("cleanup-hourly")
  async cleanupHourly(@Headers("authorization") authorization?: string) {
    this.assertAuthorized(authorization);
    await this.cleanupTask.runCleanup();
    return { status: "completed" };
  }

  @Get("cleanup-daily")
  async cleanupDaily(@Headers("authorization") authorization?: string) {
    this.assertAuthorized(authorization);
    await this.cleanupTask.runDailyCleanup();
    return { status: "completed" };
  }

  @Get("medication-lifecycle")
  async medicationLifecycle(@Headers("authorization") authorization?: string) {
    this.assertAuthorized(authorization);
    await this.medicationLifecycleTask.run();
    return { status: "completed" };
  }

  @Get("school-year-lifecycle-expiration")
  async schoolYearLifecycleExpiration(
    @Headers("authorization") authorization?: string,
  ) {
    this.assertAuthorized(authorization);
    await this.schoolYearLifecycleTask.run();
    return { status: "completed" };
  }

  private assertAuthorized(authorization?: string): void {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedException();
    }
  }
}
