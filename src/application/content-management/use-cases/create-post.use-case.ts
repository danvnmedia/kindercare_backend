import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Post, PostAudience, PostStatus } from "@/domain/content-management";
import { PostRepository } from "../ports/post.repository";
import { PostCategoryRepository } from "../ports/post-category.repository";
import { AudienceType } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";

import { PostContent } from "@/domain/content-management/entities/post.entity";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  extractTextFromTiptap,
  validateAudiencesBelongToCampus,
} from "../utils";

export interface CreatePostInput {
  campusId: string;
  title: string;
  content?: PostContent;
  publishAt?: Date;
  audiences: {
    audienceType: AudienceType;
    audienceId?: string; // Optional for ALL type (uses campusId)
  }[];
  categoryIds?: string[];
}

@Injectable()
export class CreatePostUseCase {
  private readonly logger = new Logger(CreatePostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("POST_CATEGORY_REPOSITORY")
    private readonly postCategoryRepository: PostCategoryRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: CreatePostInput, currentUser: User): Promise<Post> {
    try {
      this.logger.log(
        `Creating post: ${input.title} by user ${currentUser.id}`,
      );

      this.validateInput(input);

      // Validate that audience targets belong to the specified campus
      await validateAudiencesBelongToCampus(input.audiences, input.campusId, {
        classRepository: this.classRepository,
      });

      await this.validateCategoryIds(input.categoryIds, input.campusId);

      const author = await this.userRepository.findById(currentUser.id);
      if (!author) {
        throw new BadRequestException("Author not found");
      }

      const post = this.createPostEntity(input, author);

      const createdPost = await this.unitOfWork.run(async (tx) => {
        const saved = await tx.createPost(post, {
          categoryIds: input.categoryIds,
        });
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "CREATE_POST",
          targetType: "post",
          targetId: saved.id.toString(),
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: saved.title,
          },
          afterValue: this.toAuditSnapshot(saved),
        });
        return saved;
      });
      this.logger.log(`Post created: ${createdPost.id.toString()}`);

      return createdPost;
    } catch (error) {
      this.logger.error(`Failed to create post: ${error.message}`, error.stack);
      throw error;
    }
  }

  private validateInput(input: CreatePostInput): void {
    if (!input.campusId) {
      throw new BadRequestException("Campus ID is required");
    }

    if (!input.title || input.title.trim().length === 0) {
      throw new BadRequestException("Post title cannot be empty");
    }

    if (input.audiences.length === 0) {
      throw new BadRequestException("Post must have at least one audience");
    }
  }

  private async validateCategoryIds(
    categoryIds: string[] | undefined,
    campusId: string,
  ): Promise<void> {
    if (!categoryIds?.length) return;

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

  private toAuditSnapshot(post: Post): Record<string, unknown> {
    return {
      title: post.title,
      status: post.status,
      publishAt: post.publishAt?.toISOString() ?? null,
      contentVersion: post.contentVersion,
    };
  }

  private createPostEntity(input: CreatePostInput, author: User): Post {
    // Extract plain text from JSON content for search
    const contentText = input.content
      ? extractTextFromTiptap(input.content)
      : null;

    const postProps = {
      campusId: input.campusId,
      authorId: author.id,
      author: author,
      title: input.title,
      content: input.content ?? null,
      contentText: contentText,
      contentVersion: 1,
      publishAt: input.publishAt,
      status: PostStatus.DRAFT,
      audiences: [],
      attachments: [],
      createdAt: new Date(),
    };

    const post = Post.create(postProps);

    // Create PostAudience entities with the post's campusId
    // For ALL type, use campusId as audienceId if not provided
    const audiences = input.audiences.map((audience) => {
      // Determine audienceId: use provided value, or campusId for ALL type
      let audienceId: string;
      if (audience.audienceId) {
        audienceId = audience.audienceId;
      } else if (audience.audienceType === AudienceType.ALL) {
        audienceId = input.campusId;
      } else {
        throw new BadRequestException(
          `audienceId is required for ${audience.audienceType} audience type`,
        );
      }

      return PostAudience.create({
        postId: post.id,
        campusId: input.campusId,
        audienceType: audience.audienceType,
        audienceId,
      });
    });
    post.setAudiences(audiences);

    return post;
  }
}
