import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import {
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiHeader,
  ApiParam,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";

// Use Cases
import { DeleteStudentUseCase } from "@/application/user-management/use-cases/student/delete-student.use-case";

/**
 * Danger Student Controller
 *
 * Provides dangerous/destructive operations on students.
 * These endpoints should be used with caution and are intended for admin use only.
 *
 * All endpoints in this controller perform irreversible operations.
 */
@Controller("danger/students")
@ApiTags("Danger - Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class DangerStudentController {
  constructor(private readonly deleteStudentUseCase: DeleteStudentUseCase) {}

  @Delete(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student permanently deleted",
    type: null,
  })
  @ApiOperation({
    summary: "Permanently delete a student (DANGER)",
    description:
      "DANGER: Permanently deletes a student within the specified campus. This action is IRREVERSIBLE. For soft delete (archiving), use DELETE /students/:id instead.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to verify student access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Student ID",
    type: "string",
    format: "uuid",
  })
  async hardDelete(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.deleteStudentUseCase.execute(id, campusId);
  }
}
