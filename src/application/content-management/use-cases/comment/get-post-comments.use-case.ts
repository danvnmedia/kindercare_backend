import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { PostCommentRepository } from "../../ports/post-comment.repository";
import { PostComment } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

/**
 * Comment with nested replies for tree structure
 */
export interface CommentWithReplies {
  comment: PostComment;
  replies: CommentWithReplies[];
  replyCount: number;
}

/**
 * Result containing paginated root comments with nested replies
 */
export interface GetPostCommentsResult {
  comments: CommentWithReplies[];
  pagination: PaginatedResult<PostComment>["pagination"];
  totalCount: number;
  activeCount: number;
}

@Injectable()
export class GetPostCommentsUseCase {
  private readonly logger = new Logger(GetPostCommentsUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_COMMENT_REPOSITORY")
    private readonly postCommentRepository: PostCommentRepository,
  ) {}

  async execute(
    postId: string,
    campusId: string,
    currentUser: User,
    params: StandardRequest,
  ): Promise<GetPostCommentsResult> {
    try {
      this.logger.log(`Fetching comments for post: ${postId}`);

      const post = await this.postRepository.findVisibleById(
        postId,
        campusId,
        currentUser,
      );
      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      // Get paginated root comments
      const rootCommentsResult =
        await this.postCommentRepository.findRootCommentsByPostId(
          postId,
          params,
        );

      // Build tree structure for each root comment
      const commentsWithReplies = await Promise.all(
        rootCommentsResult.data.map((comment) =>
          this.buildCommentTree(comment),
        ),
      );

      // Get total and active counts
      const [totalCount, activeCount] = await Promise.all([
        this.postCommentRepository.countPublicByPost(postId),
        this.postCommentRepository.countActivePublicByPost(postId),
      ]);

      this.logger.log(
        `Found ${rootCommentsResult.pagination.count} root comments, ${totalCount} total`,
      );

      return {
        comments: commentsWithReplies,
        pagination: rootCommentsResult.pagination,
        totalCount,
        activeCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch comments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Recursively builds a comment tree with nested replies
   */
  private async buildCommentTree(
    comment: PostComment,
  ): Promise<CommentWithReplies> {
    const replies = await this.postCommentRepository.findRepliesByCommentId(
      comment.id,
    );

    const nestedReplies = await Promise.all(
      replies.map((reply) => this.buildCommentTree(reply)),
    );

    return {
      comment,
      replies: nestedReplies,
      replyCount: this.countAllReplies(nestedReplies),
    };
  }

  /**
   * Counts all replies including nested ones
   */
  private countAllReplies(replies: CommentWithReplies[]): number {
    return replies.reduce((count, reply) => {
      return count + 1 + this.countAllReplies(reply.replies);
    }, 0);
  }
}
