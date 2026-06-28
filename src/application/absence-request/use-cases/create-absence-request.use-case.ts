import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";

import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import {
  AbsenceRequest,
  AbsenceRequestType,
  getUtcDateOnly,
  normalizeDateOnly,
  parseTimeToMinute,
} from "@/domain/absence-request";
import { User } from "@/domain/user-management/user.entity";

import { AbsenceRequestRepository } from "../ports";
import { CurrentGuardianResolver } from "./guardian-resolution";

export interface CreateAbsenceRequestInput {
  studentId: string;
  absenceType: AbsenceRequestType;
  startDate: string | Date;
  endDate?: string | Date;
  startTime?: string | null;
  endTime?: string | null;
  description: string;
}

@Injectable()
export class CreateAbsenceRequestUseCase extends CurrentGuardianResolver {
  constructor(
    @Inject("ABSENCE_REQUEST_REPOSITORY")
    private readonly absenceRequestRepository: AbsenceRequestRepository,
    @Inject("GUARDIAN_REPOSITORY")
    guardianRepository: GuardianRepository,
  ) {
    super(guardianRepository);
  }

  async execute(
    campusId: string,
    currentUser: User,
    input: CreateAbsenceRequestInput,
  ): Promise<AbsenceRequest> {
    const guardian = await this.resolveCurrentGuardian(campusId, currentUser);
    await this.assertGuardianCanRequestForStudent(
      guardian.id.toString(),
      campusId,
      input.studentId,
    );

    const absenceRequest = this.createEntity(
      campusId,
      currentUser,
      guardian.id.toString(),
      input,
    );

    if (absenceRequest.startDate.getTime() < getUtcDateOnly().getTime()) {
      throw new BadRequestException(
        "Absence request dates cannot be in the past",
      );
    }

    const overlaps = await this.absenceRequestRepository.findActiveOverlaps(
      campusId,
      absenceRequest.studentId,
      absenceRequest.period,
    );

    if (overlaps.length > 0) {
      throw new ConflictException(
        "An active absence request already overlaps this period",
      );
    }

    return this.absenceRequestRepository.save(absenceRequest);
  }

  private createEntity(
    campusId: string,
    currentUser: User,
    requesterGuardianId: string,
    input: CreateAbsenceRequestInput,
  ): AbsenceRequest {
    try {
      return AbsenceRequest.create({
        campusId,
        studentId: input.studentId,
        requesterGuardianId,
        requesterUserId: currentUser.id.toString(),
        absenceType: input.absenceType,
        startDate: normalizeDateOnly(input.startDate, "Start date"),
        endDate: normalizeDateOnly(
          input.endDate ?? input.startDate,
          "End date",
        ),
        startMinute: parseTimeToMinute(input.startTime),
        endMinute: parseTimeToMinute(input.endTime),
        description: input.description,
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  private async assertGuardianCanRequestForStudent(
    guardianId: string,
    campusId: string,
    studentId: string,
  ): Promise<void> {
    const children = await this.guardianRepository.getGuardianChildrenInCampus(
      guardianId,
      campusId,
    );

    if (!children.some(({ student }) => student.id.toString() === studentId)) {
      throw new ForbiddenException(
        "Student is not linked to the current guardian",
      );
    }
  }
}
