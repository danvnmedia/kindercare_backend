import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  AudienceType,
  Post,
  PostAudience,
  PostHistoryStatus,
  PostStatus,
} from "@/domain/content-management";
import { PostContent } from "@/domain/content-management/entities/post.entity";
import { User } from "@/domain/user-management/user.entity";

import { PostCategoryRepository } from "../ports/post-category.repository";
import {
  assertValidPostAudiences,
  extractTextFromTiptap,
  validateAudiencesBelongToCampus,
} from "../utils";
import { userCanManagePost } from "./authorization/post-permission.helper";

export interface UpdatePostInput {
  campusId: string;
  expectedUpdatedAt?: Date;
  title?: string;
  content?: PostContent;
  publishAt?: Date;
  audiences?: {
    audienceType: AudienceType;
    audienceId?: string;
  }[];
  categoryIds?: string[];
}

@Injectable()
export class UpdatePostUseCase {
  private readonly logger = new Logger(UpdatePostUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("POST_CATEGORY_REPOSITORY")
    private readonly postCategoryRepository: PostCategoryRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    postId: string,
    input: UpdatePostInput,
    currentUser: User,
  ): Promise<Post> {
    try {
      this.logger.log(`Updating post: ${postId}`);
      if (!this.hasUpdates(input)) {
        throw new BadRequestException(
          "At least one post field must be updated",
        );
      }
      if (input.audiences !== undefined) {
        assertValidPostAudiences(input.audiences);
      }

      const updatedPost = await this.unitOfWork.run(async (tx) => {
        const post = await tx.findPostByIdForUpdate(postId);
        if (!post) {
          throw new NotFoundException(`Post with ID ${postId} not found`);
        }
        if (post.campusId !== input.campusId) {
          throw new ForbiddenException(
            "You do not have access to this post in the specified campus",
          );
        }
        if (!userCanManagePost(currentUser, input.campusId, post.authorId)) {
          throw new ForbiddenException(
            "You are not authorized to update this post",
          );
        }
        if (
          input.expectedUpdatedAt &&
          post.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()
        ) {
          throw new ConflictException(
            "Post changed since it was loaded. Refresh before saving.",
          );
        }
        if (post.status === PostStatus.PENDING_REVIEW) {
          throw new BadRequestException(
            "Pending-review posts cannot be edited; revise the post first",
          );
        }
        if (post.status === PostStatus.ARCHIVED) {
          throw new BadRequestException("Archived posts cannot be edited");
        }
        const pendingRequest =
          await tx.findPendingPostApprovalRequestForUpdate(postId);
        if (pendingRequest) {
          throw new BadRequestException(
            "Posts with a pending approval request cannot be edited",
          );
        }

        await this.validateCategoryIds(input.categoryIds, input.campusId);
        if (input.audiences !== undefined) {
          await validateAudiencesBelongToCampus(
            input.audiences,
            input.campusId,
            { classRepository: this.classRepository },
          );
        }

        const beforeValue = this.toAuditSnapshot(post);
        const previousStatus = post.status;
        await this.updatePostProperties(post, input);

        if (previousStatus === PostStatus.PUBLISHED) {
          post.moveToDraft();
          post.unpin();
        }

        const saved = await tx.updatePost(postId, post, {
          categoryIds: input.categoryIds,
          replaceAudiences: input.audiences !== undefined,
        });
        if (previousStatus !== saved.status) {
          await tx.createPostHistoryStatus(
            PostHistoryStatus.create({
              postId,
              changedById: currentUser.id,
              previousStatus,
              newStatus: saved.status,
              reason: "Published post edited; review required again",
            }),
          );
        }
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "UPDATE_POST",
          targetType: "post",
          targetId: saved.id.toString(),
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: saved.title,
            requiresResubmission: previousStatus === PostStatus.PUBLISHED,
          },
          beforeValue,
          afterValue: this.toAuditSnapshot(saved),
        });
        return saved;
      });

      this.logger.log(`Post updated: ${updatedPost.id.toString()}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to update post: ${error.message}`, error.stack);
      throw error;
    }
  }

  private hasUpdates(input: UpdatePostInput): boolean {
    return (
      input.title !== undefined ||
      input.content !== undefined ||
      input.publishAt !== undefined ||
      input.audiences !== undefined ||
      input.categoryIds !== undefined
    );
  }

  private toAuditSnapshot(post: Post): Record<string, unknown> {
    return {
      title: post.title,
      status: post.status,
      publishAt: post.publishAt?.toISOString() ?? null,
      contentVersion: post.contentVersion,
      isPinned: post.isPinned,
    };
  }

  private async validateCategoryIds(
    categoryIds: string[] | undefined,
    campusId: string,
  ): Promise<void> {
    if (categoryIds === undefined || categoryIds.length === 0) return;

    const uniqueCategoryIds = [...new Set(categoryIds)];
    const categories = await Promise.all(
      uniqueCategoryIds.map((categoryId) =>
        this.postCategoryRepository.findById(categoryId),
      ),
    );

    const invalidCategory = categories.find(
      (category) =>
        !category || category.campusId !== campusId || category.isArchived,
    );
    if (invalidCategory !== undefined) {
      throw new BadRequestException(
        "One or more post categories are invalid for this campus",
      );
    }
  }

  private async updatePostProperties(
    post: Post,
    input: UpdatePostInput,
  ): Promise<void> {
    if (input.title !== undefined) {
      post.updateTitle(input.title);
    }
    if (input.content !== undefined) {
      const contentText = input.content
        ? extractTextFromTiptap(input.content)
        : null;
      post.updateContent(input.content, contentText);
    }
    if (input.publishAt !== undefined) {
      post.updatePublishDate(input.publishAt);
    }
    if (input.audiences !== undefined) {
      post.setAudiences(
        input.audiences.map((audience) => {
          let audienceId: string;
          if (audience.audienceType === AudienceType.ALL) {
            audienceId = post.campusId;
          } else if (audience.audienceId) {
            audienceId = audience.audienceId;
          } else {
            throw new BadRequestException(
              `audienceId is required for ${audience.audienceType} audience type`,
            );
          }

          return PostAudience.create({
            postId: post.id,
            campusId: post.campusId,
            audienceType: audience.audienceType,
            audienceId,
          });
        }),
      );
    }
  }
}
