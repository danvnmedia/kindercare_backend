import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
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
} from "../../dtos/class-management";

import { WithdrawFromSchoolUseCase } from "@/application/class-management/use-cases/school-year-enrollment/withdraw-from-school.use-case";

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
  ) {}

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
        exitDate: dto.exitDate ? new Date(dto.exitDate) : undefined,
        note: dto.note,
      },
      currentUser,
    );
  }
}
