import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AbsenceRequest, AbsenceRequestStatus } from "@/domain/absence-request";
import { User } from "@/domain/user-management/user.entity";

import { AbsenceRequestRepository } from "../ports";

export type ReviewAbsenceRequestStatus =
  | AbsenceRequestStatus.APPROVED
  | AbsenceRequestStatus.DENIED;

export interface ReviewAbsenceRequestInput {
  status: ReviewAbsenceRequestStatus;
  reviewNote?: string | null;
}

@Injectable()
export class ReviewAbsenceRequestUseCase {
  constructor(
    @Inject("ABSENCE_REQUEST_REPOSITORY")
    private readonly absenceRequestRepository: AbsenceRequestRepository,
  ) {}

  async execute(
    campusId: string,
    id: string,
    input: ReviewAbsenceRequestInput,
    currentUser: User,
  ): Promise<AbsenceRequest> {
    const absenceRequest = await this.absenceRequestRepository.findByIdInCampus(
      campusId,
      id,
    );

    if (!absenceRequest) {
      throw new NotFoundException("Absence request not found");
    }

    try {
      absenceRequest.review(
        input.status,
        currentUser.id.toString(),
        input.reviewNote,
      );
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    return this.absenceRequestRepository.update(absenceRequest);
  }
}
