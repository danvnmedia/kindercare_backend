import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { AttachmentRepository } from "../ports/attachment.repository";
import { PostRepository } from "../ports/post.repository";
import { User } from "@/domain/user-management/user.entity";
import { Attachment } from "@/domain/content-management";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

export interface AddAttachmentInput {
  postId: string;
  fileId: string;
  comment?: string;
}

@Injectable()
export class AddAttachmentUseCase {
  private readonly logger = new Logger(AddAttachmentUseCase.name);

  constructor(
    @Inject("ATTACHMENT_REPOSITORY")
    private readonly attachmentRepository: AttachmentRepository,
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(
    input: AddAttachmentInput,
    currentUser: User,
  ): Promise<Attachment> {
    try {
      this.logger.log(
        `Adding attachment to post: ${input.postId}, file: ${input.fileId}`,
      );
      const post = await this.postRepository.findById(input.postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${input.postId} not found`);
      }

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");

      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException(
          "You are not authorized to add attachments to this post",
        );
      }

      const attachments = await this.attachmentRepository.findByPostId(
        input.postId,
      );
      const maxOrder = attachments.reduce(
        (max, att) => Math.max(max, att.order),
        -1,
      );

      const attachment = Attachment.create({
        postId: input.postId,
        fileId: input.fileId,
        comment: input.comment,
        order: maxOrder + 1,
      });

      const createdAttachment =
        await this.attachmentRepository.create(attachment);
      this.logger.log(`Attachment added: ${createdAttachment.id.toString()}`);

      return createdAttachment;
    } catch (error) {
      this.logger.error(
        `Failed to add attachment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
