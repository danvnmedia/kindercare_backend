import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { PostTransitionAction } from "@/domain/content-management/enums";
import { Post } from "@/domain/content-management/entities/post.entity";
import { User } from "@/domain/user-management/user.entity";
import { TransitionPostUseCase } from "./transition-post.use-case";
import {
  getRequiredPostTransitionPermission,
  userHasPostPermission,
} from "./authorization/post-permission.helper";

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
    if (postIds.length === 0) {
      throw new BadRequestException("At least one post is required");
    }

    if (postIds.length > BatchTransitionPostUseCase.MAX_BATCH_SIZE) {
      throw new BadRequestException(
        `Batch transitions are limited to ${BatchTransitionPostUseCase.MAX_BATCH_SIZE} posts`,
      );
    }

    const uniquePostIds = [...new Set(postIds)];
    const requiredPermission = getRequiredPostTransitionPermission(action);
    if (!requiredPermission) {
      throw new BadRequestException("Invalid post transition action");
    }
    if (!userHasPostPermission(user, campusId, requiredPermission)) {
      throw new ForbiddenException(
        `You do not have permission to ${action} posts`,
      );
    }

    if (action === PostTransitionAction.REJECT && !comment?.trim()) {
      throw new BadRequestException(
        "A comment is required when rejecting posts",
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
        const mappedError = this.mapError(error);
        if (mappedError.statusCode >= 500) {
          this.logger.error(
            `Batch post transition ${action} failed for post ${postId}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
        results.push({
          postId,
          success: false,
          error: mappedError,
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

  private mapError(error: unknown): BatchTransitionPostError {
    if (!(error instanceof HttpException) || error.getStatus() >= 500) {
      return {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to transition post",
        statusCode: 500,
      };
    }

    const response = error.getResponse();
    return {
      code: this.getHttpErrorCode(error, response),
      message: this.getHttpErrorMessage(error, response),
      statusCode: error.getStatus(),
    };
  }

  private getHttpErrorCode(
    error: HttpException,
    response: string | object,
  ): string {
    if (this.isRecord(response)) {
      if (typeof response.code === "string") {
        return this.normalizeErrorCode(response.code);
      }
      if (typeof response.error === "string") {
        return this.normalizeErrorCode(response.error);
      }
    }

    return this.normalizeErrorCode(error.name.replace(/Exception$/, ""));
  }

  private getHttpErrorMessage(
    error: HttpException,
    response: string | object,
  ): string {
    if (typeof response === "string") return response;
    if (this.isRecord(response)) {
      if (typeof response.message === "string") return response.message;
      if (
        Array.isArray(response.message) &&
        response.message.every((value) => typeof value === "string")
      ) {
        return response.message.join(", ");
      }
    }
    return error.message;
  }

  private normalizeErrorCode(value: string): string {
    return (
      value
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase() || "HTTP_ERROR"
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }
}
