import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Post, PostAudience, PostStatus } from "@/domain/content-management";
import { PostRepository } from "../ports/post.repository";
import { AudienceType } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { PostContent } from "@/domain/content-management/entities/post.entity";
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
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
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
        gradeLevelRepository: this.gradeLevelRepository,
        studentRepository: this.studentRepository,
      });

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
    const audiences = input.audiences.map((audience) =>
      PostAudience.create({
        postId: post.id,
        campusId: input.campusId,
        audienceType: audience.audienceType,
        audienceId: audience.audienceId,
      }),
    );
    post.setAudiences(audiences);

    return post;
  }
}
