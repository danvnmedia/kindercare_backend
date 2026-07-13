import { FileRepository } from "@/application/file-management/ports/file.repository";
import { Attachment } from "@/domain/content-management";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
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
import {
  userCanManagePost,
  userHasPostPermission,
} from "./authorization/post-permission.helper";
import {
  assertAttachmentMutationAllowed,
  rethrowAttachmentMutationError,
} from "./attachment-workflow.helper";

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

      if (
        !userCanManagePost(
          currentUser,
          input.campusId,
          post.authorId.toString(),
        )
      ) {
        throw new ForbiddenException(
          "You are not authorized to add attachments to this post",
        );
      }

      assertAttachmentMutationAllowed(post);

      const canAttachAnyFile = userHasPostPermission(
        currentUser,
        input.campusId,
        "post.manage",
      );

      // Repeat these checks in appendToPost under row locks to prevent races.
      const file = await this.fileRepository.findById(input.fileId);
      if (!file) {
        throw new NotFoundException(`File with ID ${input.fileId} not found`);
      }
      if (file.campusId !== post.campusId) {
        throw new BadRequestException(
          "File must belong to the same campus as the post",
        );
      }

      if (!file.isAvailable()) {
        throw new BadRequestException(
          "File must be available to be attached to a post",
        );
      }
      if (file.purpose !== FilePurpose.POST_ATTACHMENT) {
        throw new BadRequestException(
          "Only files uploaded for post attachments can be attached",
        );
      }
      if (
        file.uploadedBy.toString() !== currentUser.id.toString() &&
        !canAttachAnyFile
      ) {
        throw new ForbiddenException(
          "Only the uploader or a user with post.manage can attach this file",
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

      const createdAttachment = await this.attachmentRepository.appendToPost(
        attachment,
        {
          changedById: currentUser.id,
          reason: "Attachment added",
          canAttachAnyFile,
        },
      );
      this.logger.log(`Attachment added: ${createdAttachment.id.toString()}`);

      return createdAttachment;
    } catch (error) {
      this.logger.error(
        `Failed to add attachment: ${error.message}`,
        error.stack,
      );
      rethrowAttachmentMutationError(error);
    }
  }
}
