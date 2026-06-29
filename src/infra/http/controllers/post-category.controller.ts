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
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";
import {
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../decorators";
import { User } from "@/domain/user-management/user.entity";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { StandardRequestParam } from "@/core/modules/standard-response";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

// DTOs
import {
  PostCategoryResponse,
  CreatePostCategoryRequest,
  UpdatePostCategoryRequest,
  ReorderPostCategoriesRequest,
} from "../dtos/post/category";

// Use Cases
import {
  CreatePostCategoryUseCase,
  UpdatePostCategoryUseCase,
  DeletePostCategoryUseCase,
  GetAllPostCategoriesUseCase,
  ReorderPostCategoriesUseCase,
} from "@/application/content-management/use-cases/category";

@Controller("post-categories")
@ApiTags("Post Categories")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class PostCategoryController {
  constructor(
    private readonly createPostCategoryUseCase: CreatePostCategoryUseCase,
    private readonly updatePostCategoryUseCase: UpdatePostCategoryUseCase,
    private readonly deletePostCategoryUseCase: DeletePostCategoryUseCase,
    private readonly getAllPostCategoriesUseCase: GetAllPostCategoriesUseCase,
    private readonly reorderPostCategoriesUseCase: ReorderPostCategoriesUseCase,
  ) {}

  @Get()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Post categories retrieved successfully",
    type: PostCategoryResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all post categories",
    description:
      "Retrieve all post categories with pagination, filtering, and sorting. Supports filtering by name, isArchived, order. Default sort by order ascending.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to filter post categories",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findAll(
    @CampusContext() campusId: string,
    @StandardRequestParam() query: StandardRequestDto,
  ) {
    return await this.getAllPostCategoriesUseCase.execute(campusId, query);
  }

  @Post()
  @RequireCampusAccess()
  @UseGuards(RolesGuard)
  @Roles("admin", "super_admin", "manager")
  @StandardResponse({
    message: "Post category created successfully",
    type: PostCategoryResponse,
  })
  @ApiOperation({
    summary: "Create a new post category",
    description:
      "Create a new post category with a unique name within the campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the post category creation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreatePostCategoryRequest,
    @CurrentUser() user: User,
  ) {
    return await this.createPostCategoryUseCase.execute(
      {
        campusId,
        name: dto.name,
        color: dto.color,
        icon: dto.icon,
        order: dto.order,
      },
      user,
    );
  }

  @Patch(":id")
  @RequireCampusAccess()
  @UseGuards(RolesGuard)
  @Roles("admin", "super_admin", "manager")
  @StandardResponse({
    message: "Post category updated successfully",
    type: PostCategoryResponse,
  })
  @ApiOperation({
    summary: "Update a post category",
    description: "Update post category name, color, icon, or order.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the post category update",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Post Category UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdatePostCategoryRequest,
    @CurrentUser() user: User,
  ) {
    return await this.updatePostCategoryUseCase.execute(
      id,
      {
        ...dto,
        campusId,
      },
      user,
    );
  }

  @Delete(":id")
  @RequireCampusAccess()
  @UseGuards(RolesGuard)
  @Roles("admin", "super_admin", "manager")
  @StandardResponse({
    message: "Post category archived successfully",
    type: PostCategoryResponse,
  })
  @ApiOperation({
    summary: "Archive a post category",
    description:
      "Archives a post category (soft delete). Existing posts with this category remain associated.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the post category deletion",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Post Category UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async delete(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() user: User,
  ) {
    return await this.deletePostCategoryUseCase.execute(id, campusId, user);
  }

  @Post("reorder")
  @RequireCampusAccess()
  @UseGuards(RolesGuard)
  @Roles("admin", "super_admin", "manager")
  @StandardResponse({
    message: "Post categories reordered successfully",
    type: PostCategoryResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Reorder post categories",
    description:
      "Reorder post categories based on the provided array of IDs. The order field will be set based on the array index (index 0 = order 1, index 1 = order 2, etc.).",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the reorder operation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async reorder(
    @CampusContext() campusId: string,
    @Body() dto: ReorderPostCategoriesRequest,
    @CurrentUser() user: User,
  ) {
    return await this.reorderPostCategoriesUseCase.execute(
      {
        ...dto,
        campusId,
      },
      user,
    );
  }
}
