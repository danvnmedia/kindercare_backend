import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  Post,
  PostAudience,
  PostStatus,
  PostType,
} from "@/domain/content-management";
import { PostRepository } from "../ports/post.repository";
import { AudienceType } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { UserRepository } from "@/application/user-management/ports/user.repository";

export interface CreatePostInput {
  type: PostType;
  title: string;
  content?: string;
  publishAt?: Date;
  audiences: {
    audienceType: AudienceType;
    audienceId: string;
  }[];
}

@Injectable()
export class CreatePostUseCase {
  private readonly logger = new Logger(CreatePostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: CreatePostInput, currentUser: User): Promise<Post> {
    try {
      this.logger.log(
        `Creating post: ${input.title} by user ${currentUser.id}`,
      );

      this.validateInput(input);

      const author = await this.userRepository.findById(currentUser.id);
      if (!author) {
        throw new BadRequestException("Author not found");
      }

      const post = this.createPostEntity(input, author);

      const createdPost = await this.postRepository.create(post);
      this.logger.log(`Post created: ${createdPost.id.toString()}`);

      return createdPost;
    } catch (error) {
      this.logger.error(`Failed to create post: ${error.message}`, error.stack);
      throw error;
    }
  }

  private validateInput(input: CreatePostInput): void {
    if (!input.title || input.title.trim().length === 0) {
      throw new BadRequestException("Post title cannot be empty");
    }

    if (input.audiences.length === 0) {
      throw new BadRequestException("Post must have at least one audience");
    }
  }

  private createPostEntity(input: CreatePostInput, author: User): Post {
    const postProps = {
      authorId: author.id,
      author: author,
      type: input.type,
      title: input.title,
      content: input.content,
      publishAt: input.publishAt,
      status: PostStatus.DRAFT,
      audiences: [],
      attachments: [],
      createdAt: new Date(),
    };

    return Post.create(postProps);
  }
}
