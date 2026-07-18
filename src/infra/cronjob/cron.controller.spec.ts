import { UnauthorizedException } from "@nestjs/common";
import { CronController } from "./cron.controller";
import { CleanupTask } from "./tasks/cleanup.task";
import { MedicationLifecycleReconciliationTask } from "./tasks/medication-lifecycle-reconciliation.task";
import { SchoolYearLifecycleExpirationTask } from "./tasks/school-year-lifecycle-expiration.task";

describe("CronController", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const cleanupTask = {
    runCleanup: jest.fn().mockResolvedValue(undefined),
    runDailyCleanup: jest.fn().mockResolvedValue(undefined),
  } as unknown as CleanupTask;
  const medicationTask = {
    run: jest.fn().mockResolvedValue(undefined),
  } as unknown as MedicationLifecycleReconciliationTask;
  const schoolYearTask = {
    run: jest.fn().mockResolvedValue(undefined),
  } as unknown as SchoolYearLifecycleExpirationTask;

  const controller = new CronController(
    cleanupTask,
    medicationTask,
    schoolYearTask,
  );

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret-1234";
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it("rejects requests without the configured bearer secret", async () => {
    await expect(controller.cleanupHourly()).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(cleanupTask.runCleanup).not.toHaveBeenCalled();
  });

  it("runs the requested task for an authorized request", async () => {
    await expect(
      controller.cleanupHourly("Bearer test-cron-secret-1234"),
    ).resolves.toEqual({ status: "completed" });
    expect(cleanupTask.runCleanup).toHaveBeenCalledTimes(1);
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    await expect(
      controller.medicationLifecycle("Bearer undefined"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(medicationTask.run).not.toHaveBeenCalled();
  });
});
