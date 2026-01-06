import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { Controller, Delete, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";

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
  @StandardResponse({
    message: "Staff permanently deleted",
    type: null,
  })
  @ApiOperation({
    summary: "Permanently delete a staff member (DANGER)",
    description:
      "DANGER: Permanently deletes a staff member, their user account, and Clerk identity. This action is IRREVERSIBLE. For soft delete (archiving), use DELETE /staff/:id instead.",
  })
  async hardDelete(@Param("id") id: string) {
    await this.deleteStaffUseCase.execute(id);
  }
}
