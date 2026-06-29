import { FileRepository } from "@/application/file-management/ports/file.repository";
import { Attachment } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { AttachmentRepository } from "../ports/attachment.repository";
import { PostRepository } from "../ports/post.repository";

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
      const isAdmin = currentUser.hasSystemRole();

      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException(
          "You are not authorized to add attachments to this post",
        );
      }

      // Verify file exists and belongs to the same campus
      // Note: Repository already excludes soft-deleted files
      const file = await this.fileRepository.findById(input.fileId);
      if (!file) {
        throw new NotFoundException(`File with ID ${input.fileId} not found`);
      }
      if (file.campusId !== post.campusId) {
        throw new BadRequestException(
          "File must belong to the same campus as the post",
        );
      }

      // Verify file is available (uploaded or processed, and not deleted)
      if (!file.isAvailable()) {
        throw new BadRequestException(
          "File must be uploaded and not deleted to be attached to a post",
        );
      }

      const attachments = await this.attachmentRepository.findByPostId(
        input.postId,
      );
      if (
        attachments.some((attachment) => attachment.fileId === input.fileId)
      ) {
        throw new BadRequestException("File is already attached to this post");
      }

      const attachment = Attachment.create({
        postId: input.postId,
        fileId: input.fileId,
        comment: input.comment,
        order: 0,
      });

      const createdAttachment =
        await this.attachmentRepository.appendToPost(attachment);
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
