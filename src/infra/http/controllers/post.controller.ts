import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
} from "@nestjs/swagger";
import {
  StandardRequestParam,
  StandardResponse,
} from "@/core/modules/standard-response/decorators";
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
  BatchTransitionPostUseCase,
  BatchTransitionPostOutput,
} from "@/application/content-management/use-cases";
import {
  TogglePostReactionUseCase,
  GetPostReactionStatusUseCase,
  TogglePostReactionResult,
  PostReactionStatusResult,
} from "@/application/content-management/use-cases/reaction";
import {
  GetPendingApprovalsUseCase,
  GetPostApprovalHistoryUseCase,
} from "@/application/content-management/use-cases/approval";
import {
  PinPostUseCase,
  UnpinPostUseCase,
  GetPinnedPostsUseCase,
} from "@/application/content-management/use-cases/pin";
import {
  CreatePostRequest,
  UpdatePostRequest,
  AddAttachmentRequest,
  ReorderAttachmentsRequest,
  TransitionPostRequest,
  BatchTransitionPostRequest,
  BatchTransitionPostResponse,
  PinPostRequest,
} from "@/infra/http/dtos/post/index";
import {
  PostResponse,
  AttachmentResponse,
  PostAudienceFacetsResponse,
} from "@/infra/http/dtos/post/post.response";
import { PostReactionResponse } from "@/infra/http/dtos/post/post-reaction.response";
import { ApprovalRequestResponse } from "../dtos/post/approval";
import { PostHistoryStatusResponse } from "@/infra/http/dtos/post/post-history.response";
import {
  CurrentUser,
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
  CmsPublicRead,
  CmsStaffOnly,
} from "../decorators";
import { User } from "@/domain/user-management/user.entity";
import { Post as PostEntity } from "@/domain/content-management/entities/post.entity";
import { PostHistoryStatus } from "@/domain/content-management/entities/post-history-status.entity";
import { PostApprovalRequest } from "@/domain/content-management";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { Permissions } from "../decorators/permissions.decorator";
import {
  StandardRequest,
  PaginatedResult,
} from "@/core/modules/standard-response";

@ApiTags("Content Management")
@ApiBearerAuth("JWT")
@Controller("posts")
@UseGuards(ClerkAuthGuard)
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
    private readonly batchTransitionPostUseCase: BatchTransitionPostUseCase,
    private readonly getPostHistoryUseCase: GetPostHistoryUseCase,
    private readonly togglePostReactionUseCase: TogglePostReactionUseCase,
    private readonly getPostReactionStatusUseCase: GetPostReactionStatusUseCase,
    private readonly getPendingApprovalsUseCase: GetPendingApprovalsUseCase,
    private readonly getPostApprovalHistoryUseCase: GetPostApprovalHistoryUseCase,
    private readonly pinPostUseCase: PinPostUseCase,
    private readonly unpinPostUseCase: UnpinPostUseCase,
    private readonly getPinnedPostsUseCase: GetPinnedPostsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.create", "post.manage")
  @ApiOperation({ summary: "Create a new post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to create the post in",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
    status: HttpStatus.CREATED,
  })
  async create(
    @CampusContext() campusId: string,
    @Body() createPostDto: CreatePostRequest,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    // Ensure campusId from context is used (overrides any DTO value for security)
    return this.createPostUseCase.execute({ ...createPostDto, campusId }, user);
  }

  @Get()
  @CmsPublicRead()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.list", "post.manage")
  @ApiOperation({ summary: "List all posts" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to list posts for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
    isPaginated: true,
    allowedSortFields: [
      "createdAt",
      "updatedAt",
      "title",
      "status",
      "isPinned",
    ],
    allowedFilterFields: [
      "title",
      "status",
      "publishAt",
      "authorId",
      "categoryId",
      "isPinned",
      "audienceType",
      "classId",
    ],
  })
  async findMany(
    @CampusContext() campusId: string,
    @StandardRequestParam() params: StandardRequest,
    @CurrentUser() user: User,
  ) {
    return this.listPostsUseCase.execute(campusId, params, user);
  }

  @Get("facets")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.list", "post.manage")
  @ApiOperation({ summary: "Get post audience filter facets" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to get post facets for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostAudienceFacetsResponse,
    allowedFilterFields: ["status", "categoryId"],
  })
  async getAudienceFacets(
    @CampusContext() campusId: string,
    @StandardRequestParam() params: StandardRequest,
    @CurrentUser() user: User,
  ) {
    return this.listPostsUseCase.getAudienceFacets(campusId, params, user);
  }

  @Get("pending-approval")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.review", "post.manage")
  @ApiOperation({ summary: "Get pending approval requests for a campus" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to get pending approvals for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: ApprovalRequestResponse,
    isPaginated: true,
    allowedSortFields: ["submittedAt", "createdAt"],
    allowedFilterFields: ["submittedById"],
  })
  async getPendingApprovals(
    @CampusContext() campusId: string,
    @StandardRequestParam() params: StandardRequest,
    @CurrentUser() user: User,
  ): Promise<PaginatedResult<PostApprovalRequest>> {
    return this.getPendingApprovalsUseCase.execute(campusId, params, user);
  }

  @Get("pinned")
  @CmsPublicRead()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Get pinned posts for a campus" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to get pinned posts for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
    isArray: true,
  })
  async getPinnedPosts(
    @CampusContext() campusId: string,
    @CurrentUser() user: User,
  ): Promise<PostEntity[]> {
    return this.getPinnedPostsUseCase.execute(campusId, user);
  }

  @Get(":id")
  @CmsPublicRead()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Get a post by ID" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
  })
  async findOne(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.getPostUseCase.execute(campusId, id, user);
  }

  @Patch(":id")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.update", "post.manage")
  @ApiOperation({ summary: "Update a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
  })
  async update(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() updatePostDto: UpdatePostRequest,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.updatePostUseCase.execute(
      id,
      { ...updatePostDto, campusId },
      user,
    );
  }

  @Delete(":id")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.delete", "post.manage")
  @ApiOperation({ summary: "Delete a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: null,
  })
  async remove(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.deletePostUseCase.execute(campusId, id, user);
  }

  @Post(":id/attachments")
  @HttpCode(HttpStatus.CREATED)
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.update", "post.manage")
  @ApiOperation({ summary: "Add an attachment to a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: AttachmentResponse,
    status: HttpStatus.CREATED,
  })
  async addAttachment(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() addAttachmentDto: AddAttachmentRequest,
    @CurrentUser() user: User,
  ) {
    return this.addAttachmentUseCase.execute(
      {
        postId: id,
        campusId,
        ...addAttachmentDto,
      },
      user,
    );
  }

  @Delete(":id/attachments/:attachmentId")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.update", "post.manage")
  @ApiOperation({ summary: "Remove an attachment from a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: null,
  })
  async removeAttachment(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.removeAttachmentUseCase.execute(
      campusId,
      id,
      attachmentId,
      user,
    );
  }

  @Patch(":id/attachments/reorder")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.update", "post.manage")
  @ApiOperation({ summary: "Reorder attachments in a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
  })
  async reorderAttachments(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() reorderAttachmentsDto: ReorderAttachmentsRequest,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.reorderAttachmentsUseCase.execute(
      {
        postId: id,
        campusId,
        ...reorderAttachmentsDto,
      },
      user,
    );
  }

  @Post("batch-transition")
  @HttpCode(HttpStatus.CREATED)
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.update", "post.review", "post.manage")
  @ApiOperation({ summary: "Batch transition post statuses" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the posts",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: BatchTransitionPostResponse,
    status: HttpStatus.CREATED,
  })
  async batchTransitionPosts(
    @CampusContext() campusId: string,
    @Body() { postIds, action, comment }: BatchTransitionPostRequest,
    @CurrentUser() user: User,
  ): Promise<BatchTransitionPostOutput> {
    return this.batchTransitionPostUseCase.execute(
      campusId,
      postIds,
      action,
      user,
      comment,
    );
  }

  @Post(":id/transition")
  @HttpCode(HttpStatus.CREATED)
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.update", "post.review", "post.manage")
  @ApiOperation({ summary: "Transition the status of a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
    status: HttpStatus.CREATED,
  })
  async transitionPost(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() { action, comment }: TransitionPostRequest,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.transitionPostUseCase.execute(
      campusId,
      id,
      action,
      user,
      comment,
    );
  }

  @Get(":id/history")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Get post history" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostHistoryStatusResponse,
    isArray: true,
  })
  async getPostHistory(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ): Promise<PostHistoryStatus[]> {
    return this.getPostHistoryUseCase.execute(campusId, id);
  }

  @Get(":id/approval-history")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.review", "post.manage")
  @ApiOperation({ summary: "Get approval history for a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({ type: ApprovalRequestResponse, isArray: true })
  async getApprovalHistory(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ): Promise<PostApprovalRequest[]> {
    return this.getPostApprovalHistoryUseCase.execute(campusId, id);
  }

  @Post(":id/heart")
  @HttpCode(HttpStatus.CREATED)
  @CmsPublicRead()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Toggle heart reaction on a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostReactionResponse,
    status: HttpStatus.CREATED,
  })
  async toggleHeart(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() user: User,
  ): Promise<TogglePostReactionResult> {
    return this.togglePostReactionUseCase.execute(campusId, id, user);
  }

  @Get(":id/heart")
  @CmsPublicRead()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Get heart reaction status for a post" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostReactionResponse,
  })
  async getHeartStatus(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() user: User,
  ): Promise<PostReactionStatusResult> {
    return this.getPostReactionStatusUseCase.execute(campusId, id, user);
  }

  // --- Pinning Endpoints ---

  @Post(":id/pin")
  @HttpCode(HttpStatus.CREATED)
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.manage")
  @ApiOperation({ summary: "Pin a post to the top of the feed (admin only)" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
    status: HttpStatus.CREATED,
  })
  async pinPost(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: PinPostRequest,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.pinPostUseCase.execute(campusId, id, dto, user);
  }

  @Delete(":id/pin")
  @CmsStaffOnly()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.manage")
  @ApiOperation({ summary: "Unpin a post (admin only)" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID context for the post",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @StandardResponse({
    type: PostResponse,
  })
  async unpinPost(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() user: User,
  ): Promise<PostEntity> {
    return this.unpinPostUseCase.execute(campusId, id, user);
  }
}
