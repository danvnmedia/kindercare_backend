import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { User } from "@/domain/user-management/user.entity";

import {
  WithdrawFromSchoolRequest,
  WithdrawFromSchoolResponse,
  CancelSchoolYearEnrollmentRequest,
  CancelSchoolYearEnrollmentResponse,
  CancellationBadRequestResponse,
  CancellationForbiddenResponse,
  CancellationNotFoundResponse,
  CancelSchoolYearEnrollmentConflictResponse,
} from "../../dtos/class-management";

import { WithdrawFromSchoolUseCase } from "@/application/class-management/use-cases/school-year-enrollment/withdraw-from-school.use-case";
import { CancelSchoolYearEnrollmentUseCase } from "@/application/class-management/use-cases/school-year-enrollment/cancel-school-year-enrollment.use-case";
import { CancelSchoolYearEnrollmentResult } from "@/application/class-management/school-year-enrollment-cancellation";
import { parseDateOnly } from "@/application/class-management/date-only";
import { Permissions } from "../../decorators/permissions.decorator";
import { PermissionsGuard } from "../../guards/permissions.guard";

/**
 * SchoolYearEnrollment Lifecycle Controller
 *
 * Hosts lifecycle operations keyed by the parent's own id (URL prefix
 * `/school-year-enrollments`). Currently houses the atomic withdraw cascade
 * defined by specs/school-year-enrollment-model D4 + AC-22. Kept separate from
 * `SchoolYearEnrollmentController` (mounted at `/students`) because the URL
 * prefixes differ.
 */
@Controller("school-year-enrollments")
@ApiTags("School Year Enrollments")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class SchoolYearEnrollmentLifecycleController {
  constructor(
    private readonly withdrawFromSchoolUseCase: WithdrawFromSchoolUseCase,
    private readonly cancelSchoolYearEnrollmentUseCase: CancelSchoolYearEnrollmentUseCase,
  ) {}

  @Post(":id/cancel")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("school_year_enrollment.cancel")
  @StandardResponse({
    message: "Upcoming school-year enrollment cancelled",
    type: CancelSchoolYearEnrollmentResponse,
  })
  @ApiOperation({
    summary: "Cancel an upcoming school-year enrollment",
    description:
      "Atomically cancels the upcoming parent registration and every uncancelled upcoming class placement beneath it. The operation is idempotent after success and does not emit another audit event on replay.",
  })
  @ApiBadRequestResponse({
    type: CancellationBadRequestResponse,
    description:
      "The cancellation reason is missing or invalid, the note is not a string, or the trimmed note exceeds 500 characters.",
  })
  @ApiForbiddenResponse({
    type: CancellationForbiddenResponse,
    description:
      "Requires selected-campus access and school_year_enrollment.cancel in that campus.",
  })
  @ApiNotFoundResponse({
    type: CancellationNotFoundResponse,
    description:
      "The school-year enrollment does not exist in the selected campus. Cross-campus resources use this same hidden response.",
  })
  @ApiConflictResponse({
    type: CancelSchoolYearEnrollmentConflictResponse,
    description:
      "The enrollment is already effective/closed, has an active-child inconsistency, or changed concurrently. Error codes are ENROLLMENT_ALREADY_EFFECTIVE, ENROLLMENT_ALREADY_CLOSED, CANCELLATION_CHILD_STATE_CONFLICT, or ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Selected campus UUID; this is an enforced scope.",
  })
  @ApiParam({
    name: "id",
    description: "SchoolYearEnrollment UUID",
    type: "string",
    format: "uuid",
  })
  async cancel(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelSchoolYearEnrollmentRequest,
    @CurrentUser() currentUser: User,
  ): Promise<CancelSchoolYearEnrollmentResponse> {
    const result = await this.cancelSchoolYearEnrollmentUseCase.execute(
      {
        id,
        campusId,
        cancellationReason: dto.cancellationReason,
        note: dto.note,
      },
      currentUser,
    );

    return toCancelResponse(result);
  }

  @Post(":id/withdraw")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student withdrawn from school year",
    type: WithdrawFromSchoolResponse,
  })
  @ApiOperation({
    summary: "Withdraw a student from a school year (atomic cascade)",
    description:
      "Atomically closes the parent SchoolYearEnrollment and any open class-level enrollment in a single database transaction (specs/school-year-enrollment-model D4). The same exitDate and exitReason apply to both rows; if no open class enrollment exists, `closedChild` is null.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "SchoolYearEnrollment UUID",
    type: "string",
    format: "uuid",
  })
  async withdraw(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: WithdrawFromSchoolRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.withdrawFromSchoolUseCase.execute(
      {
        id,
        campusId,
        reason: dto.reason,
        exitDate: dto.exitDate ? parseDateOnly(dto.exitDate) : undefined,
        note: dto.note,
      },
      currentUser,
    );
  }
}

function toCancelResponse(
  result: CancelSchoolYearEnrollmentResult,
): CancelSchoolYearEnrollmentResponse {
  const referenceDate = new Date();
  const parent = result.parent;

  return {
    resultStatus: result.resultStatus,
    parent: {
      id: parent.id,
      studentId: parent.studentId,
      campusId: parent.campusId,
      schoolYearId: parent.schoolYearId,
      gradeLevelId: parent.gradeLevelId,
      enrollmentDate: parent.enrollmentDate,
      exitDate: parent.exitDate,
      exitReason: parent.exitReason,
      note: parent.note,
      effectiveStatus: parent.getEffectiveStatus(referenceDate),
      cancelledAt: parent.cancelledAt,
      cancellationReason: parent.cancellationReason,
      cancellationNote: parent.cancellationNote,
      cancelledBy: parent.cancelledByUserId
        ? {
            id: parent.cancelledByUserId,
            fullName: parent.cancelledByFullName,
          }
        : null,
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
    },
    affectedChildren: result.affectedChildren.map((child) => ({
      id: child.id,
      classId: child.classId,
      studentId: child.studentId,
      schoolYearEnrollmentId: child.schoolYearEnrollmentId,
      enrollmentDate: child.enrollmentDate,
      endDate: child.endDate,
      exitReason: child.exitReason,
      note: child.note,
      effectiveStatus: child.getEffectiveStatus(referenceDate),
      cancelledAt: child.cancelledAt,
      cancellationReason: child.cancellationReason,
      cancellationNote: child.cancellationNote,
      cancelledBy: child.cancelledByUserId
        ? {
            id: child.cancelledByUserId,
            fullName: child.cancelledByFullName,
          }
        : null,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
    })),
    affectedChildIds: result.affectedChildIds,
    affectedChildCount: result.affectedChildCount,
    idempotentReplay: result.idempotentReplay,
  };
}
