import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { Controller, Delete, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";

// Use Cases
import { DeleteGuardianUseCase } from "@/application/user-management/use-cases/guardian/delete-guardian.use-case";

/**
 * Danger Guardian Controller
 *
 * Provides dangerous/destructive operations on guardians.
 * These endpoints should be used with caution and are intended for admin use only.
 *
 * All endpoints in this controller perform irreversible operations.
 */
@Controller("danger/guardians")
@ApiTags("Danger - Guardians")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class DangerGuardianController {
  constructor(private readonly deleteGuardianUseCase: DeleteGuardianUseCase) {}

  @Delete(":id")
  @StandardResponse({
    message: "Guardian permanently deleted",
    type: null,
  })
  @ApiOperation({
    summary: "Permanently delete a guardian (DANGER)",
    description:
      "DANGER: Permanently deletes a guardian, their user account, and Clerk identity. This action is IRREVERSIBLE. For soft delete (archiving), use DELETE /guardians/:id instead.",
  })
  async hardDelete(@Param("id") id: string) {
    await this.deleteGuardianUseCase.execute(id);
  }
}
