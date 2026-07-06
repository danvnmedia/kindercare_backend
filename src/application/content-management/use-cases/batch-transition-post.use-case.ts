import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { PostTransitionAction } from "@/domain/content-management/enums";
import { Post } from "@/domain/content-management/entities/post.entity";
import { User } from "@/domain/user-management/user.entity";
import { TransitionPostUseCase } from "./transition-post.use-case";
import { userHasPostPermission } from "./authorization/post-permission.helper";

export interface BatchTransitionPostError {
  code: string;
  message: string;
  statusCode: number;
}

export interface BatchTransitionPostResult {
  postId: string;
  success: boolean;
  post?: Post;
  error?: BatchTransitionPostError;
}

export interface BatchTransitionPostOutput {
  total: number;
  succeeded: number;
  failed: number;
  results: BatchTransitionPostResult[];
}

@Injectable()
export class BatchTransitionPostUseCase {
  private readonly logger = new Logger(BatchTransitionPostUseCase.name);
  private static readonly MAX_BATCH_SIZE = 100;

  constructor(private readonly transitionPostUseCase: TransitionPostUseCase) {}

  async execute(
    campusId: string,
    postIds: string[],
    action: PostTransitionAction,
    user: User,
    comment?: string,
  ): Promise<BatchTransitionPostOutput> {
    const uniquePostIds = [...new Set(postIds)];

    if (uniquePostIds.length === 0) {
      throw new BadRequestException("At least one post is required");
    }

    if (uniquePostIds.length > BatchTransitionPostUseCase.MAX_BATCH_SIZE) {
      throw new BadRequestException(
        `Batch transitions are limited to ${BatchTransitionPostUseCase.MAX_BATCH_SIZE} posts`,
      );
    }

    const requiredPermission = this.getRequiredPermission(action);
    if (!userHasPostPermission(user, campusId, requiredPermission)) {
      throw new ForbiddenException(
        `You do not have permission to ${action} posts`,
      );
    }

    const results: BatchTransitionPostResult[] = [];

    for (const postId of uniquePostIds) {
      try {
        const post = await this.transitionPostUseCase.execute(
          campusId,
          postId,
          action,
          user,
          comment,
        );
        results.push({ postId, success: true, post });
      } catch (error) {
        const statusCode = this.getStatusCode(error);
        results.push({
          postId,
          success: false,
          error: {
            code: this.getErrorCode(error),
            message:
              error instanceof Error
                ? error.message
                : "Failed to transition post",
            statusCode,
          },
        });
      }
    }

    const succeeded = results.filter((result) => result.success).length;
    const failed = results.length - succeeded;

    this.logger.log(
      `Batch post transition ${action}: ${succeeded}/${results.length} succeeded for campus ${campusId}`,
    );

    return {
      total: results.length,
      succeeded,
      failed,
      results,
    };
  }

  private getRequiredPermission(action: PostTransitionAction): string {
    switch (action) {
      case PostTransitionAction.APPROVE:
      case PostTransitionAction.REJECT:
      case PostTransitionAction.REVISE:
        return "post.review";
      default:
        return "post.update";
    }
  }

  private getStatusCode(error: unknown): number {
    if (typeof error === "object" && error && "getStatus" in error) {
      const getStatus = (error as { getStatus?: () => number }).getStatus;
      if (typeof getStatus === "function") return getStatus.call(error);
    }
    return 500;
  }

  private getErrorCode(error: unknown): string {
    const name = error instanceof Error ? error.name : "Error";
    return name.replace(/Exception$/, "").toUpperCase() || "ERROR";
  }
}
