import { ConfigService } from "@nestjs/config";
import { SCHEDULE_CRON_OPTIONS } from "@nestjs/schedule/dist/schedule.constants";

import { ReconcileMedicationRequestLifecycleUseCase } from "@/application/medication";

import { MedicationLifecycleReconciliationTask } from "./medication-lifecycle-reconciliation.task";

describe("MedicationLifecycleReconciliationTask", () => {
  it("runs every five minutes with the configured bounded scan limit", async () => {
    const reconcile = {
      execute: jest.fn().mockResolvedValue({
        scanned: 25,
        completed: 10,
        expired: 5,
        skipped: 9,
        failed: 1,
      }),
    } as unknown as jest.Mocked<ReconcileMedicationRequestLifecycleUseCase>;
    const config = {
      get: jest.fn().mockReturnValue("25"),
    } as unknown as ConfigService;
    const task = new MedicationLifecycleReconciliationTask(reconcile, config);

    await task.execute();

    expect(reconcile.execute).toHaveBeenCalledWith({ limit: 25 });
    expect(
      Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        MedicationLifecycleReconciliationTask.prototype.execute,
      ),
    ).toEqual(expect.objectContaining({ cronTime: "0 */5 * * * *" }));
  });
});
