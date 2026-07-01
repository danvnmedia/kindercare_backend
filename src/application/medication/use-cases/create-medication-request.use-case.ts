import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import {
  MedicationRequest,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
} from "@/domain/medication";
import { User } from "@/domain/user-management/user.entity";

import { MedicationRequestRepository } from "../ports";
import { ParentMedicationRequestAccess } from "./parent-medication-request-access";

export interface CreateMedicationRequestItemInput {
  medicationName?: unknown;
  dosage?: unknown;
  instructions?: unknown;
  timesOfDay?: unknown;
  scheduleNotes?: unknown;
  notes?: unknown;
}

export interface CreateMedicationRequestInput {
  studentId: string;
  startDate?: unknown;
  endDate?: unknown;
  reason?: unknown;
  parentNotes?: unknown;
  items?: unknown;
}

@Injectable()
export class CreateMedicationRequestUseCase extends ParentMedicationRequestAccess {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
    @Inject("GUARDIAN_REPOSITORY")
    guardianRepository: GuardianRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {
    super(guardianRepository);
  }

  async execute(
    campusId: string,
    currentUser: User,
    input: CreateMedicationRequestInput,
  ): Promise<MedicationRequest> {
    const guardian = await this.resolveCurrentGuardian(campusId, currentUser);
    await this.assertGuardianCanAccessStudent(
      guardian.id.toString(),
      campusId,
      input.studentId,
    );

    const medicationRequest = this.createEntity(
      campusId,
      currentUser,
      guardian.id.toString(),
      input,
    );

    return this.transactionRunner.run(async (tx) => {
      const saved = await this.medicationRequestRepository.create(
        medicationRequest,
        tx,
      );

      await this.medicationRequestRepository.addTimelineEntry(
        MedicationRequestTimelineEntry.create({
          requestId: saved.id,
          campusId,
          actorType: MedicationRequestTimelineActorType.GUARDIAN,
          actorUserId: currentUser.id.toString(),
          actorGuardianId: guardian.id.toString(),
          action: MedicationRequestTimelineAction.SUBMITTED,
          note: saved.reason,
        }),
        tx,
      );

      await this.auditRecorder.record(
        {
          actorId: currentUser.id.toString(),
          action: "CREATE_MEDICATION_REQUEST",
          targetType: "medication_request",
          targetId: saved.id,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            studentId: saved.studentId,
            requesterGuardianId: saved.requesterGuardianId,
          },
          beforeValue: null,
          afterValue: pickMedicationRequestAuditFields(saved),
        },
        tx,
      );

      return (
        (await this.medicationRequestRepository.findByIdForRequesterGuardian(
          campusId,
          guardian.id.toString(),
          saved.id,
          tx,
        )) ?? saved
      );
    });
  }

  private createEntity(
    campusId: string,
    currentUser: User,
    requesterGuardianId: string,
    input: CreateMedicationRequestInput,
  ): MedicationRequest {
    try {
      return MedicationRequest.create({
        campusId,
        studentId: input.studentId,
        requesterGuardianId,
        requesterUserId: currentUser.id.toString(),
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
        parentNotes: input.parentNotes,
        items: input.items,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}

export function pickMedicationRequestAuditFields(request: MedicationRequest) {
  return {
    studentId: request.studentId,
    requesterGuardianId: request.requesterGuardianId,
    requesterUserId: request.requesterUserId,
    status: request.status,
    startDate: request.startDate.toISOString().slice(0, 10),
    endDate: request.endDate.toISOString().slice(0, 10),
    reason: request.reason,
    parentNotes: request.parentNotes,
    items: request.items.map((item) => ({
      medicationName: item.medicationName,
      dosage: item.dosage,
      instructions: item.instructions,
      timesOfDay: item.timesOfDay,
      scheduleNotes: item.scheduleNotes,
      notes: item.notes,
    })),
  };
}
