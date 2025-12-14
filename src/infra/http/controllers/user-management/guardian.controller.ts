import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";

import { Gender } from "@/domain/user-management/enums/gender.enum";
import {
  CreateGuardianRequest,
  GuardianResponse,
} from "../../dtos/user-management/guardian";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

// Use Cases
import { CreateGuardianUseCase } from "@/application/user-management/use-cases/guardian/create-guardian.use-case";
import { GetAllGuardiansUseCase } from "@/application/user-management/use-cases/guardian/get-all-guardians.use-case";

@Controller("guardians")
@ApiTags("Guardians")
// @ApiBearerAuth('JWT')
// @UseGuards(ClerkAuthGuard)
export class GuardianController {
  constructor(
    private readonly createGuardianUseCase: CreateGuardianUseCase,
    private readonly getAllGuardiansUseCase: GetAllGuardiansUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: "Guardian created successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Create a new guardian",
    description:
      "Creates a new guardian with personal information and automatically creates a Clerk account with weak password (ChangeMe12-3!) that forces password reset on first login.",
  })
  async create(@Body() dto: CreateGuardianRequest) {
    return await this.createGuardianUseCase.execute({
      ...dto,
      gender: dto.gender as Gender,
    });
  }

  @Get()
  @StandardResponse({
    message: "Guardians retrieved successfully",
    type: GuardianResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all guardians",
    description:
      "Retrieve all guardians with advanced filtering, sorting, and pagination. Supports filtering by fullName, occupation, workAddress. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).",
  })
  async findAll(@Query() query: StandardRequestDto) {
    return await this.getAllGuardiansUseCase.execute(query);
  }
}
