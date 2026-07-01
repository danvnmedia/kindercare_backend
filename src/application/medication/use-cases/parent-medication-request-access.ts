import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { User } from "@/domain/user-management/user.entity";

export abstract class ParentMedicationRequestAccess {
  protected constructor(
    protected readonly guardianRepository: GuardianRepository,
  ) {}

  protected async resolveCurrentGuardian(
    campusId: string,
    currentUser: User,
  ): Promise<Guardian> {
    if (!currentUser?.id?.toString()) {
      throw new UnauthorizedException("Authenticated user is required");
    }

    const guardian = await this.guardianRepository.findByUserIdInCampus(
      currentUser.id.toString(),
      campusId,
    );

    if (!guardian) {
      throw new ForbiddenException(
        "Current user is not a guardian in this campus",
      );
    }

    return guardian;
  }

  protected async assertGuardianCanAccessStudent(
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
