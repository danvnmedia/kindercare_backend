import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from "@nestjs/swagger";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../decorators";
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
export class PostCategoryController {
  constructor(
    private readonly createPostCategoryUseCase: CreatePostCategoryUseCase,
    private readonly updatePostCategoryUseCase: UpdatePostCategoryUseCase,
    private readonly deletePostCategoryUseCase: DeletePostCategoryUseCase,
    private readonly getAllPostCategoriesUseCase: GetAllPostCategoriesUseCase,
    private readonly reorderPostCategoriesUseCase: ReorderPostCategoriesUseCase,
  ) {}

  @Get()
  @RequireCampusAccess({ checkUserAccess: false })
  @StandardResponse({
    message: "Post categories retrieved successfully",
    type: PostCategoryResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all post categories",
    description:
      "Retrieve all post categories with pagination, filtering, and sorting. Supports filtering by name, isActive, order. Default sort by order ascending.",
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
  @StandardResponse({
    message: "Post category created successfully",
    type: PostCategoryResponse,
  })
  @ApiOperation({
    summary: "Create a new post category",
    description:
      "Create a new post category with a unique name within the campus.",
  })
  async create(@Body() dto: CreatePostCategoryRequest) {
    return await this.createPostCategoryUseCase.execute({
      campusId: dto.campusId,
      name: dto.name,
      color: dto.color,
      icon: dto.icon,
      order: dto.order,
    });
  }

  @Patch(":id")
  @StandardResponse({
    message: "Post category updated successfully",
    type: PostCategoryResponse,
  })
  @ApiOperation({
    summary: "Update a post category",
    description: "Update post category name, color, icon, or order.",
  })
  @ApiParam({
    name: "id",
    description: "Post Category UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePostCategoryRequest,
  ) {
    return await this.updatePostCategoryUseCase.execute(id, dto);
  }

  @Delete(":id")
  @StandardResponse({
    message: "Post category deactivated successfully",
    type: PostCategoryResponse,
  })
  @ApiOperation({
    summary: "Deactivate a post category",
    description:
      "Deactivates a post category (soft delete). Existing posts with this category remain associated.",
  })
  @ApiParam({
    name: "id",
    description: "Post Category UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async delete(@Param("id") id: string) {
    return await this.deletePostCategoryUseCase.execute(id);
  }

  @Post("reorder")
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
  async reorder(@Body() dto: ReorderPostCategoriesRequest) {
    return await this.reorderPostCategoriesUseCase.execute(dto);
  }
}
