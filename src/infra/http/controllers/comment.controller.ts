import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from "@nestjs/swagger";
import {
  StandardRequestParam,
  StandardResponse,
} from "@/core/modules/standard-response/decorators";
import { StandardRequest } from "@/core/modules/standard-response";
import {
  CreatePostCommentUseCase,
  CreateCommentReplyUseCase,
  UpdatePostCommentUseCase,
  DeletePostCommentUseCase,
  GetPostCommentsUseCase,
  GetManagementCommentsUseCase,
  CreateManagementCommentUseCase,
  DeleteManagementCommentUseCase,
} from "@/application/content-management/use-cases/comment";
import {
  CreateCommentRequest,
  UpdateCommentRequest,
  CommentResponse,
  GetCommentsResponse,
} from "@/infra/http/dtos/comment";
import { CampusContext, CurrentUser, RequireCampusAccess } from "../decorators";
import { User } from "@/domain/user-management/user.entity";
import { PostComment } from "@/domain/content-management";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { Permissions } from "../decorators/permissions.decorator";

@ApiTags("Comments")
@ApiBearerAuth("JWT")
@Controller()
@UseGuards(ClerkAuthGuard)
export class CommentController {
  constructor(
    private readonly createPostCommentUseCase: CreatePostCommentUseCase,
    private readonly createCommentReplyUseCase: CreateCommentReplyUseCase,
    private readonly updatePostCommentUseCase: UpdatePostCommentUseCase,
    private readonly deletePostCommentUseCase: DeletePostCommentUseCase,
    private readonly getPostCommentsUseCase: GetPostCommentsUseCase,
    private readonly getManagementCommentsUseCase: GetManagementCommentsUseCase,
    private readonly createManagementCommentUseCase: CreateManagementCommentUseCase,
    private readonly deleteManagementCommentUseCase: DeleteManagementCommentUseCase,
  ) {}

  @Get("posts/:postId/comments")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({
    summary: "Get comments for a post with nested tree structure",
  })
  @ApiParam({
    name: "postId",
    description: "The ID of the post",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @StandardResponse({
    type: GetCommentsResponse,
    isPaginated: true,
    allowedSortFields: ["createdAt", "updatedAt"],
    allowedFilterFields: ["userId", "isDeleted"],
  })
  async getPostComments(
    @Param("postId") postId: string,
    @StandardRequestParam() params: StandardRequest,
  ) {
    return this.getPostCommentsUseCase.execute(postId, params);
  }

  @Get("posts/:postId/management-comments")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.manage")
  @ApiOperation({ summary: "Get management notes for a post" })
  @StandardResponse({
    type: CommentResponse,
    isArray: true,
    message: "Management notes retrieved successfully",
  })
  async getManagementComments(
    @Param("postId") postId: string,
    @CampusContext() campusId: string,
  ): Promise<PostComment[]> {
    return this.getManagementCommentsUseCase.execute(postId, campusId);
  }

  @Post("posts/:postId/management-comments")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.manage")
  @ApiOperation({ summary: "Add a management note to a post" })
  @StandardResponse({
    type: CommentResponse,
    message: "Management note created successfully",
  })
  async createManagementComment(
    @Param("postId") postId: string,
    @Body() createCommentDto: CreateCommentRequest,
    @CampusContext() campusId: string,
    @CurrentUser() user: User,
  ): Promise<PostComment> {
    return this.createManagementCommentUseCase.execute(
      {
        postId,
        campusId,
        content: createCommentDto.content,
      },
      user,
    );
  }

  @Delete("posts/:postId/management-comments/:commentId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.manage")
  @ApiOperation({ summary: "Delete a management note from a post" })
  @StandardResponse({
    type: null,
    message: "Management note deleted successfully",
  })
  async deleteManagementComment(
    @Param("postId") postId: string,
    @Param("commentId") commentId: string,
    @CampusContext() campusId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.deleteManagementCommentUseCase.execute(
      postId,
      commentId,
      campusId,
      user,
    );
  }

  @Post("posts/:postId/comments")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Add a root comment to a post" })
  @ApiParam({
    name: "postId",
    description: "The ID of the post",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @StandardResponse({
    type: CommentResponse,
    message: "Comment created successfully",
  })
  async createComment(
    @Param("postId") postId: string,
    @Body() createCommentDto: CreateCommentRequest,
    @CampusContext() campusId: string,
    @CurrentUser() user: User,
  ): Promise<PostComment> {
    return this.createPostCommentUseCase.execute(
      {
        postId,
        campusId,
        content: createCommentDto.content,
      },
      user,
    );
  }

  @Post("comments/:commentId/replies")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Reply to an existing comment" })
  @ApiParam({
    name: "commentId",
    description: "The ID of the parent comment to reply to",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @StandardResponse({
    type: CommentResponse,
    message: "Reply created successfully",
  })
  async createReply(
    @Param("commentId") commentId: string,
    @Body() createCommentDto: CreateCommentRequest,
    @CampusContext() campusId: string,
    @CurrentUser() user: User,
  ): Promise<PostComment> {
    return this.createCommentReplyUseCase.execute(
      {
        parentCommentId: commentId,
        campusId,
        content: createCommentDto.content,
      },
      user,
    );
  }

  @Patch("comments/:commentId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Update a comment (owner only)" })
  @ApiParam({
    name: "commentId",
    description: "The ID of the comment to update",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @StandardResponse({
    type: CommentResponse,
    message: "Comment updated successfully",
  })
  async updateComment(
    @Param("commentId") commentId: string,
    @Body() updateCommentDto: UpdateCommentRequest,
    @CurrentUser() user: User,
  ): Promise<PostComment> {
    return this.updatePostCommentUseCase.execute(
      commentId,
      { content: updateCommentDto.content },
      user,
    );
  }

  @Delete("comments/:commentId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("post.read", "post.manage")
  @ApiOperation({ summary: "Delete a comment (soft delete)" })
  @ApiParam({
    name: "commentId",
    description: "The ID of the comment to delete",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @StandardResponse({
    type: null,
    message: "Comment deleted successfully",
  })
  async deleteComment(
    @Param("commentId") commentId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.deletePostCommentUseCase.execute(commentId, user);
  }
}
