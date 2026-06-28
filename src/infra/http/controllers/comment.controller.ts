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
} from "@/application/content-management/use-cases/comment";
import {
  CreateCommentRequest,
  UpdateCommentRequest,
  CommentResponse,
  GetCommentsResponse,
} from "@/infra/http/dtos/comment";
import { CurrentUser } from "../decorators";
import { User } from "@/domain/user-management/user.entity";
import { PostComment } from "@/domain/content-management";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";

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
  ) {}

  @Get("posts/:postId/comments")
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

  @Post("posts/:postId/comments")
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
    @CurrentUser() user: User,
  ): Promise<PostComment> {
    return this.createPostCommentUseCase.execute(
      {
        postId,
        content: createCommentDto.content,
      },
      user,
    );
  }

  @Post("comments/:commentId/replies")
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
    @CurrentUser() user: User,
  ): Promise<PostComment> {
    return this.createCommentReplyUseCase.execute(
      {
        parentCommentId: commentId,
        content: createCommentDto.content,
      },
      user,
    );
  }

  @Patch("comments/:commentId")
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
