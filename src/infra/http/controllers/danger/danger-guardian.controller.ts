import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { Controller, Delete, Param, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiHeader,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";

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
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian permanently deleted",
    type: null,
  })
  @ApiOperation({
    summary: "Permanently delete a guardian (DANGER)",
    description:
      "DANGER: Permanently deletes a guardian within the specified campus, their user account, and Clerk identity. This action is IRREVERSIBLE. For soft delete (archiving), use DELETE /guardians/:id instead.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to verify guardian access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async hardDelete(@CampusContext() campusId: string, @Param("id") id: string) {
    await this.deleteGuardianUseCase.execute(id, campusId);
  }
}
