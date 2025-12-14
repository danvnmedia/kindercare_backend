import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Post, PostAudience, PostStatus } from "@/domain/content-management";
import { PostRepository } from "../ports/post.repository";
import { AudienceType } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

export interface UpdatePostInput {
  title?: string;
  content?: string;
  status?: PostStatus;
  publishAt?: Date;
  audiences?: {
    audienceType: AudienceType;
    audienceId: string;
  }[];
}

@Injectable()
export class UpdatePostUseCase {
  private readonly logger = new Logger(UpdatePostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
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

      this.checkAuthorization(post, currentUser);

      this.updatePostProperties(post, input);

      const updatedPost = await this.postRepository.update(postId, post);
      this.logger.log(`Post updated: ${updatedPost.id.toString()}`);

      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to update post: ${error.message}`, error.stack);
      throw error;
    }
  }

  private checkAuthorization(post: Post, user: User): void {
    const isAuthor = post.authorId.toString() === user.id.toString();
    const isAdmin = user.roles?.some((role) => role.name === "Admin");

    if (!isAuthor && !isAdmin) {
      throw new ForbiddenException(
        "You are not authorized to update this post",
      );
    }
  }

  private updatePostProperties(post: Post, input: UpdatePostInput): void {
    if (input.title) {
      post.updateTitle(input.title);
    }
    if (input.content !== undefined) {
      post.updateContent(input.content);
    }
    if (input.status) {
      // Note: Status transitions should use specific domain methods
      // This is a generic update - consider using publish(), archive(), etc.
      throw new Error(
        "Direct status update not allowed. Use specific transition methods (publish, archive, etc.)"
      );
    }
    if (input.publishAt !== undefined) {
      post.updatePublishDate(input.publishAt);
    }
    if (input.audiences) {
      const audiences = input.audiences.map((audience) =>
        PostAudience.create({
          postId: post.id,
          audienceType: audience.audienceType,
          audienceId: audience.audienceId,
        }),
      );
      post.setAudiences(audiences);
    }
  }
}
