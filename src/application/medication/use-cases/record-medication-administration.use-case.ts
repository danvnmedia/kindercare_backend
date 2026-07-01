import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import {
  MedicationAdministrationLog,
  MedicationAdministrationOutcome,
  parseTimeToMinute,
} from "@/domain/medication";
import { User } from "@/domain/user-management/user.entity";

import { MedicationAdministrationRepository } from "../ports";
import {
  mapOccurrenceRecordToItem,
  MedicationAdministrationRecordResult,
} from "./get-daily-medication-administrations.use-case";

export interface RecordMedicationAdministrationInput {
  outcome?: MedicationAdministrationOutcome;
  actualTime?: string | null;
  note?: string | null;
  correctionOfLogId?: string | null;
}

@Injectable()
export class RecordMedicationAdministrationUseCase {
  constructor(
    @Inject("MEDICATION_ADMINISTRATION_REPOSITORY")
    private readonly medicationAdministrationRepository: MedicationAdministrationRepository,
    private readonly transactionRunner: TransactionRunnerPort,
  ) {}

  async execute(
    campusId: string,
    occurrenceId: string,
    input: RecordMedicationAdministrationInput,
    currentUser: User,
    recordedAt = new Date(),
  ): Promise<MedicationAdministrationRecordResult> {
    const outcome = this.normalizeOutcome(input?.outcome);
    const actualMinute = this.normalizeActualMinute(input?.actualTime);
    const correctionOfLogId = input?.correctionOfLogId ?? null;
    this.assertRecordPermission(
      currentUser,
      campusId,
      correctionOfLogId
        ? "medication_administration.update"
        : "medication_administration.create",
    );

    return this.transactionRunner.run(async (tx) => {
      const occurrence =
        await this.medicationAdministrationRepository.findOccurrenceByIdInCampus(
          campusId,
          occurrenceId,
          tx,
        );

      if (!occurrence) {
        throw new NotFoundException("Medication administration not found");
      }

      const expectedLatestLogId = await this.resolveExpectedLatestLogId(
        occurrence.id,
        occurrence.latestLogId,
        correctionOfLogId,
        tx,
      );

      const log = this.createDomainLog({
        occurrenceId: occurrence.id,
        outcome,
        recordedByUserId: currentUser.id.toString(),
        recordedAt,
        actualMinute,
        note: input.note,
        correctionOfLogId,
      });
      const createdLog =
        await this.medicationAdministrationRepository.createLog(log, tx);

      occurrence.applyLatestLog(createdLog);

      const updatedOccurrence =
        await this.medicationAdministrationRepository.updateOccurrenceLatestIfExpected(
          occurrence,
          expectedLatestLogId,
          tx,
        );

      if (!updatedOccurrence) {
        throw new ConflictException(
          "Medication administration changed; refresh and try again",
        );
      }

      return mapOccurrenceRecordToItem(updatedOccurrence, createdLog);
    });
  }

  private normalizeOutcome(
    outcome?: MedicationAdministrationOutcome,
  ): MedicationAdministrationOutcome {
    if (
      !outcome ||
      !Object.values(MedicationAdministrationOutcome).includes(outcome)
    ) {
      throw new BadRequestException(
        "Invalid medication administration outcome",
      );
    }

    return outcome;
  }

  private normalizeActualMinute(actualTime?: string | null): number | null {
    if (actualTime === undefined || actualTime === null) {
      return null;
    }

    try {
      return parseTimeToMinute(actualTime, "Actual time");
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  private async resolveExpectedLatestLogId(
    occurrenceId: string,
    currentLatestLogId: string | null,
    correctionOfLogId: string | null,
    tx: AppTransactionClient,
  ): Promise<string | null> {
    if (!correctionOfLogId) {
      if (currentLatestLogId) {
        throw new ConflictException(
          "Medication administration already has a recorded outcome; send a correction",
        );
      }

      return null;
    }

    if (currentLatestLogId !== correctionOfLogId) {
      throw new ConflictException(
        "Medication administration correction is stale; refresh and try again",
      );
    }

    const correctedLog =
      await this.medicationAdministrationRepository.findLogByIdForOccurrence(
        occurrenceId,
        correctionOfLogId,
        tx,
      );

    if (!correctedLog) {
      throw new ConflictException(
        "Medication administration correction target is no longer current",
      );
    }

    return correctionOfLogId;
  }

  private createDomainLog(
    props: Parameters<typeof MedicationAdministrationLog.create>[0],
  ): MedicationAdministrationLog {
    try {
      return MedicationAdministrationLog.create(props);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  private assertRecordPermission(
    currentUser: User,
    campusId: string,
    permissionId: string,
  ): void {
    const hasPermission = currentUser
      .getRolesForCampus(campusId)
      .some((role) =>
        role.permissions?.some((permission) => permission.id === permissionId),
      );

    if (!hasPermission) {
      throw new ForbiddenException(`Missing permission ${permissionId}`);
    }
  }
}
