import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";

import {
  DEFAULT_MEDICATION_RECONCILIATION_LIMIT,
  ReconcileMedicationRequestLifecycleUseCase,
} from "@/application/medication";

@Injectable()
export class MedicationLifecycleReconciliationTask {
  private readonly logger = new Logger(
    MedicationLifecycleReconciliationTask.name,
  );

  constructor(
    private readonly reconcileMedicationLifecycle: ReconcileMedicationRequestLifecycleUseCase,
    private readonly configService: ConfigService,
  ) {}

  @Cron("0 */5 * * * *")
  async execute(): Promise<void> {
    try {
      const result = await this.reconcileMedicationLifecycle.execute({
        limit: this.getScanLimit(),
      });
      this.logger.log(
        `Medication lifecycle reconciliation scanned=${result.scanned} completed=${result.completed} expired=${result.expired} skipped=${result.skipped} failed=${result.failed}`,
      );
    } catch (error) {
      this.logger.error("Medication lifecycle reconciliation failed", error);
    }
  }

  private getScanLimit(): number {
    const configured = this.configService.get<string>(
      "MEDICATION_LIFECYCLE_RECONCILIATION_LIMIT",
    );
    return configured === undefined
      ? DEFAULT_MEDICATION_RECONCILIATION_LIMIT
      : Number(configured);
  }
}
