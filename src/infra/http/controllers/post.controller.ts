import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ClassSerializerInterceptor,
  UseInterceptors,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import {
  StandardRequestParam,
  StandardResponse,
} from "@/core/modules/standard-response/decorators";
import { UserInterceptor } from "../interceptors/user.interceptor";
import {
  CreatePostUseCase,
  UpdatePostUseCase,
  DeletePostUseCase,
  GetPostUseCase,
  ListPostsUseCase,
  AddAttachmentUseCase,
  RemoveAttachmentUseCase,
  ReorderAttachmentsUseCase,
  GetPostHistoryUseCase,
  TransitionPostUseCase,
} from "@/application/content-management/use-cases";
import {
  CreatePostRequest,
  UpdatePostRequest,
  AddAttachmentRequest,
  ReorderAttachmentsRequest,
  TransitionPostRequest,
} from "@/infra/http/dtos/post/index";
import {
  PostResponse,
  AttachmentResponse,
} from "@/infra/http/dtos/post/post.response";
import { PostHistoryStatusResponse } from "@/infra/http/dtos/post/post-history.response";
import { CurrentUser } from "../decorators";
import { User } from "@/domain/user-management/user.entity";
import { Post as PostEntity } from "@/domain/content-management/entities/post.entity";
import { PostHistoryStatus } from "@/domain/content-management/entities/post-history-status.entity";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response";

@ApiTags("Content Management")
@ApiBearerAuth("JWT")
@Controller("posts")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(UserInterceptor, ClassSerializerInterceptor)
export class PostController {
  constructor(
    private readonly createPostUseCase: CreatePostUseCase,
    private readonly updatePostUseCase: UpdatePostUseCase,
    private readonly deletePostUseCase: DeletePostUseCase,
    private readonly getPostUseCase: GetPostUseCase,
    private readonly listPostsUseCase: ListPostsUseCase,
    private readonly addAttachmentUseCase: AddAttachmentUseCase,
    private readonly removeAttachmentUseCase: RemoveAttachmentUseCase,
    private readonly reorderAttachmentsUseCase: ReorderAttachmentsUseCase,
    private readonly transitionPostUseCase: TransitionPostUseCase,
    private readonly getPostHistoryUseCase: GetPostHistoryUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new post" })
  @StandardResponse({
    type: PostResponse,
  })
  async create(
    @Body() createPostDto: CreatePostRequest,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.createPostUseCase.execute(createPostDto, user);
  }

  @Get()
  @ApiOperation({ summary: "List all posts" })
  @StandardResponse({
    type: PostResponse,
    isPaginated: true,
    allowedSortFields: ["createdAt", "updatedAt", "title", "status", "type"],
    allowedFilterFields: ["title", "status", "type", "publishAt", "audiences"],
  })
  async findMany(@StandardRequestParam() params: StandardRequest) {
    return this.listPostsUseCase.execute(params);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a post by ID" })
  @StandardResponse({
    type: PostResponse,
  })
  async findOne(@Param("id") id: string): Promise<PostEntity> {
    return this.getPostUseCase.execute(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a post" })
  @StandardResponse({
    type: PostResponse,
  })
  async update(
    @Param("id") id: string,
    @Body() updatePostDto: UpdatePostRequest,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.updatePostUseCase.execute(id, updatePostDto, user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a post" })
  @StandardResponse({
    type: null,
  })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.deletePostUseCase.execute(id, user);
  }

  @Post(":id/attachments")
  @ApiOperation({ summary: "Add an attachment to a post" })
  @StandardResponse({
    type: AttachmentResponse,
  })
  async addAttachment(
    @Param("id") id: string,
    @Body() addAttachmentDto: AddAttachmentRequest,
    @CurrentUser() user: User,
  ) {
    return this.addAttachmentUseCase.execute(
      {
        postId: id,
        ...addAttachmentDto,
      },
      user,
    );
  }

  @Delete(":id/attachments/:attachmentId")
  @ApiOperation({ summary: "Remove an attachment from a post" })
  @StandardResponse({
    type: null,
  })
  async removeAttachment(
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.removeAttachmentUseCase.execute(id, attachmentId, user);
  }

  @Patch(":id/attachments/reorder")
  @ApiOperation({ summary: "Reorder attachments in a post" })
  @StandardResponse({
    type: null,
  })
  async reorderAttachments(
    @Param("id") id: string,
    @Body() reorderAttachmentsDto: ReorderAttachmentsRequest,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.reorderAttachmentsUseCase.execute(
      {
        postId: id,
        ...reorderAttachmentsDto,
      },
      user,
    );
  }

  @Post(":id/transition")
  @ApiOperation({ summary: "Transition the status of a post" })
  @StandardResponse({
    type: PostResponse,
  })
  async transitionPost(
    @Param("id") id: string,
    @Body() { action, comment }: TransitionPostRequest,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.transitionPostUseCase.execute(id, action, user, comment);
  }

  @Get(":id/history")
  @ApiOperation({ summary: "Get post history" })
  @StandardResponse({
    type: PostHistoryStatusResponse,
    isArray: true,
  })
  async getPostHistory(@Param("id") id: string): Promise<PostHistoryStatus[]> {
    return this.getPostHistoryUseCase.execute(id);
  }
}
