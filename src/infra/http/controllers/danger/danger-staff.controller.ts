import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { Controller, Delete, Param, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";

// Use Cases
import { DeleteStaffUseCase } from "@/application/user-management/use-cases/staff/delete-staff.use-case";

/**
 * Danger Staff Controller
 *
 * Provides dangerous/destructive operations on staff members.
 * These endpoints should be used with caution and are intended for admin use only.
 *
 * All endpoints in this controller perform irreversible operations.
 */
@Controller("danger/staff")
@ApiTags("Danger - Staff")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class DangerStaffController {
  constructor(private readonly deleteStaffUseCase: DeleteStaffUseCase) {}

  @Delete(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff permanently deleted",
    type: null,
  })
  @ApiOperation({
    summary: "Permanently delete a staff member (DANGER)",
    description:
      "DANGER: Permanently deletes only the staff profile within the specified campus. Linked User and Clerk identities are preserved and must be managed through global identity administration. This action is IRREVERSIBLE. For soft delete (archiving), use DELETE /staff/:id instead.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to verify staff access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async hardDelete(@CampusContext() campusId: string, @Param("id") id: string) {
    await this.deleteStaffUseCase.execute(id, campusId);
  }
}
