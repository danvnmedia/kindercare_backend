import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOperation,
  ApiTags,
  ApiParam,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { StandardRequestParam } from "@/core/modules/standard-response";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { RequestContext } from "../context/request-context.service";

import {
  CreateCampusRequest,
  UpdateCampusRequest,
  CampusResponse,
} from "../dtos/campus";

import { CreateCampusUseCase } from "@/application/campus/use-cases/create-campus.use-case";
import { GetCampusByIdUseCase } from "@/application/campus/use-cases/get-campus-by-id.use-case";
import { GetAllCampusesUseCase } from "@/application/campus/use-cases/get-all-campuses.use-case";
import { UpdateCampusUseCase } from "@/application/campus/use-cases/update-campus.use-case";
import { DeleteCampusUseCase } from "@/application/campus/use-cases/delete-campus.use-case";

@Controller("campuses")
@ApiTags("Campuses")
@UseGuards(ClerkAuthGuard)
export class CampusController {
  constructor(
    private readonly createCampusUseCase: CreateCampusUseCase,
    private readonly getCampusByIdUseCase: GetCampusByIdUseCase,
    private readonly getAllCampusesUseCase: GetAllCampusesUseCase,
    private readonly updateCampusUseCase: UpdateCampusUseCase,
    private readonly deleteCampusUseCase: DeleteCampusUseCase,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
  @StandardResponse({
    message: "Campus created successfully",
    type: CampusResponse,
  })
  @ApiOperation({
    summary: "Create a new campus",
    description:
      "Create a new campus with a unique name and required IANA timezone.",
  })
  @ApiBadRequestResponse({
    description: "Missing or invalid IANA timeZone, or another invalid field.",
  })
  async create(@Body() dto: CreateCampusRequest) {
    return await this.createCampusUseCase.execute(dto);
  }

  @Get()
  @StandardResponse({
    message: "Campuses retrieved successfully",
    type: CampusResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all campuses",
    description:
      "Retrieve campuses the authenticated user has access to based on their role assignments. Users with global roles see all campuses. Supports pagination, filtering by name, address, phoneNumber, isArchived.",
  })
  async findAll(@StandardRequestParam() query: StandardRequestDto) {
    const user = await this.requestContext.getUserOrFail();

    // Determine accessible campus IDs based on user's role assignments
    // - null: User has global role, can see all campuses
    // - [...ids]: User has campus-scoped roles, can only see those campuses
    // - []: User has no roles, sees empty result
    const accessibleCampusIds = user.hasGlobalRole()
      ? null
      : user.getAccessibleCampusIds();

    return await this.getAllCampusesUseCase.execute({
      accessibleCampusIds,
      params: query,
    });
  }

  @Get(":id")
  @StandardResponse({
    message: "Campus retrieved successfully",
    type: CampusResponse,
  })
  @ApiOperation({
    summary: "Get a campus by ID",
    description: "Retrieve a single campus by its ID.",
  })
  @ApiParam({
    name: "id",
    description: "Campus UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findById(@Param("id") id: string) {
    return await this.getCampusByIdUseCase.execute(id);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Campus updated successfully",
    type: CampusResponse,
  })
  @ApiOperation({
    summary: "Update a campus",
    description:
      "Update campus name, address, phone number, IANA timezone, or archived status.",
  })
  @ApiBadRequestResponse({
    description: "Invalid IANA timeZone or another invalid field.",
  })
  @ApiParam({
    name: "id",
    description: "Campus UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateCampusRequest) {
    return await this.updateCampusUseCase.execute(id, dto);
  }

  @Delete(":id")
  @StandardResponse({
    message: "Campus archived successfully",
    type: CampusResponse,
  })
  @ApiOperation({
    summary: "Archive a campus",
    description:
      "Soft delete a campus by setting isArchived to true. The campus data is retained.",
  })
  @ApiParam({
    name: "id",
    description: "Campus UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async delete(@Param("id") id: string) {
    return await this.deleteCampusUseCase.execute(id);
  }
}
