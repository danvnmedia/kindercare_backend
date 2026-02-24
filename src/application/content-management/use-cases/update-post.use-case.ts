import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Post, PostAudience } from "@/domain/content-management";
import { PostRepository } from "../ports/post.repository";
import { AudienceType } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { PostContent } from "@/domain/content-management/entities/post.entity";
import {
  extractTextFromTiptap,
  validateAudiencesBelongToCampus,
} from "../utils";

export interface UpdatePostInput {
  campusId: string; // For verifying request comes from correct campus
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
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    postId: string,
    input: UpdatePostInput,
    currentUser: User,
  ): Promise<Post> {
    try {
      this.logger.log(`Updating post: ${postId}`);

      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      // Verify the request campus matches the post's campus
      if (post.campusId !== input.campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }

      this.checkAuthorization(post, currentUser);

      await this.updatePostProperties(post, input);

      const updatedPost = await this.postRepository.update(postId, post, {
        categoryIds: input.categoryIds,
      });
      this.logger.log(`Post updated: ${updatedPost.id.toString()}`);

      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to update post: ${error.message}`, error.stack);
      throw error;
    }
  }

  private checkAuthorization(post: Post, user: User): void {
    const isAuthor = post.authorId.toString() === user.id.toString();
    const isAdmin = user.hasSystemRole();

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException(
        "You are not authorized to update this post",
      );
    }
  }

  private async updatePostProperties(
    post: Post,
    input: UpdatePostInput,
  ): Promise<void> {
    if (input.title) {
      post.updateTitle(input.title);
    }
    if (input.content !== undefined) {
      // Extract plain text from JSON content for search
      const contentText = input.content
        ? extractTextFromTiptap(input.content)
        : null;
      post.updateContent(input.content, contentText);
    }
    if (input.publishAt !== undefined) {
      post.updatePublishDate(input.publishAt);
    }
    if (input.audiences) {
      // Validate that new audiences belong to the post's campus
      await validateAudiencesBelongToCampus(input.audiences, post.campusId, {
        classRepository: this.classRepository,
        gradeLevelRepository: this.gradeLevelRepository,
        studentRepository: this.studentRepository,
      });

      const audiences = input.audiences.map((audience) => {
        // For ALL type, use campusId as audienceId if not provided
        let audienceId: string;
        if (audience.audienceId) {
          audienceId = audience.audienceId;
        } else if (audience.audienceType === AudienceType.ALL) {
          audienceId = post.campusId;
        } else {
          throw new ForbiddenException(
            `audienceId is required for ${audience.audienceType} audience type`,
          );
        }

        return PostAudience.create({
          postId: post.id,
          campusId: post.campusId,
          audienceType: audience.audienceType,
          audienceId,
        });
      });
      post.setAudiences(audiences);
    }
  }
}
