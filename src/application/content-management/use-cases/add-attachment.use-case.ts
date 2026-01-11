import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { AttachmentRepository } from "../ports/attachment.repository";
import { PostRepository } from "../ports/post.repository";
import { FileRepository } from "@/application/file-management/ports/file.repository";
import { User } from "@/domain/user-management/user.entity";
import { Attachment } from "@/domain/content-management";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

export interface AddAttachmentInput {
  postId: string;
  fileId: string;
  campusId: string;
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
    @Inject("FILE_REPOSITORY")
    private readonly fileRepository: FileRepository,
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

      // Verify campus access
      if (post.campusId !== input.campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");

      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException(
          "You are not authorized to add attachments to this post",
        );
      }

      // Verify file exists and belongs to the same campus
      const file = await this.fileRepository.findById(input.fileId);
      if (!file) {
        throw new NotFoundException(`File with ID ${input.fileId} not found`);
      }
      if (file.campusId !== post.campusId) {
        throw new BadRequestException(
          "File must belong to the same campus as the post",
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
