import { Module } from "@nestjs/common";
import { PostController } from "../controllers/post.controller";
import {
  CreatePostUseCase,
  UpdatePostUseCase,
  DeletePostUseCase,
  GetPostUseCase,
  ListPostsUseCase,
  AddAttachmentUseCase,
  RemoveAttachmentUseCase,
  ReorderAttachmentsUseCase,
  SubmitForReviewUseCase,
  ApprovePostUseCase,
  RejectPostUseCase,
  PublishPostUseCase,
  RevisePostUseCase,
  ArchivePostUseCase,
  GetPostHistoryUseCase,
  TransitionPostUseCase,
} from "@/application/content-management/use-cases";
import {
  PrismaPostRepository,
  PrismaAttachmentRepository,
  PrismaPostHistoryStatusRepository,
} from "@/infra/persistence/prisma/repositories";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { ClerkModule } from "@/infra/external-services/clerk/clerk.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { RolesGuard } from "../guards/roles.guard";
import { AuthModule } from "./auth.module";

@Module({
  imports: [PrismaModule, ClerkModule, StandardResponseModule, AuthModule],
  controllers: [PostController],
  providers: [
    RolesGuard,
    CreatePostUseCase,
    UpdatePostUseCase,
    DeletePostUseCase,
    GetPostUseCase,
    ListPostsUseCase,
    AddAttachmentUseCase,
    RemoveAttachmentUseCase,
    ReorderAttachmentsUseCase,
    SubmitForReviewUseCase,
    ApprovePostUseCase,
    RejectPostUseCase,
    PublishPostUseCase,
    RevisePostUseCase,
    ArchivePostUseCase,
    GetPostHistoryUseCase,
    TransitionPostUseCase,
    {
      provide: "POST_REPOSITORY",
      useClass: PrismaPostRepository,
    },
    {
      provide: "ATTACHMENT_REPOSITORY",
      useClass: PrismaAttachmentRepository,
    },
    {
      provide: "POST_HISTORY_STATUS_REPOSITORY",
      useClass: PrismaPostHistoryStatusRepository,
    },
  ],
  exports: [
    "POST_REPOSITORY",
    "ATTACHMENT_REPOSITORY",
    "POST_HISTORY_STATUS_REPOSITORY",
  ],
})
export class ContentManagementModule {}
