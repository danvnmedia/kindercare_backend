import { Module } from "@nestjs/common";
import { PostController } from "../controllers/post.controller";
import { CampusSettingController } from "../controllers/campus-setting.controller";
import { PostCategoryController } from "../controllers/post-category.controller";
import { CommentController } from "../controllers/comment.controller";
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
  BatchTransitionPostUseCase,
  GetCampusSettingUseCase,
  UpdateCampusSettingUseCase,
} from "@/application/content-management/use-cases";
import {
  CreatePostCommentUseCase,
  CreateCommentReplyUseCase,
  UpdatePostCommentUseCase,
  DeletePostCommentUseCase,
  GetPostCommentsUseCase,
  GetManagementCommentsUseCase,
  CreateManagementCommentUseCase,
  DeleteManagementCommentUseCase,
} from "@/application/content-management/use-cases/comment";
import {
  CreatePostCategoryUseCase,
  UpdatePostCategoryUseCase,
  DeletePostCategoryUseCase,
  GetAllPostCategoriesUseCase,
  ReorderPostCategoriesUseCase,
} from "@/application/content-management/use-cases/category";
import {
  TogglePostReactionUseCase,
  GetPostReactionStatusUseCase,
} from "@/application/content-management/use-cases/reaction";
import {
  GetPendingApprovalsUseCase,
  GetPostApprovalHistoryUseCase,
} from "@/application/content-management/use-cases/approval";
import {
  PinPostUseCase,
  UnpinPostUseCase,
  GetPinnedPostsUseCase,
} from "@/application/content-management/use-cases/pin";
import {
  PrismaPostRepository,
  PrismaAttachmentRepository,
  PrismaPostHistoryStatusRepository,
  PrismaCampusSettingRepository,
  PrismaPostCategoryRepository,
  PrismaPostReactionRepository,
  PrismaPostCommentRepository,
  PrismaPostApprovalRequestRepository,
} from "@/infra/persistence/prisma/repositories";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import { ClerkModule } from "@/infra/external-services/clerk/clerk.module";
import { StandardResponseModule } from "@/core/modules/standard-response/standard-response.module";
import { RolesGuard } from "../guards/roles.guard";
import { CampusGuard } from "../guards/campus.guard";
import { AuthModule } from "./auth.module";
import { UserManagementModule } from "./user-management.module";
import { ClassManagementModule } from "./class-management.module";
import { FileManagementModule } from "./file-management/file-management.module";
import { CampusModule } from "./campus.module";
import { RequestContextModule } from "../context/request-context.module";

@Module({
  imports: [
    PrismaModule,
    ClerkModule,
    StandardResponseModule,
    AuthModule,
    UserManagementModule, // For USER_REPOSITORY
    ClassManagementModule, // For CLASS_REPOSITORY
    FileManagementModule, // For FILE_REPOSITORY
    CampusModule, // For CAMPUS_REPOSITORY (CampusGuard)
    RequestContextModule, // Provides RequestContext for CampusGuard
  ],
  controllers: [
    PostController,
    CampusSettingController,
    PostCategoryController,
    CommentController,
  ],
  providers: [
    // Guards
    CampusGuard,
    RolesGuard,
    // Post Use Cases
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
    BatchTransitionPostUseCase,
    // Campus Setting Use Cases
    GetCampusSettingUseCase,
    UpdateCampusSettingUseCase,
    // Post Category Use Cases
    CreatePostCategoryUseCase,
    UpdatePostCategoryUseCase,
    DeletePostCategoryUseCase,
    GetAllPostCategoriesUseCase,
    ReorderPostCategoriesUseCase,
    // Post Reaction Use Cases
    TogglePostReactionUseCase,
    GetPostReactionStatusUseCase,
    // Post Comment Use Cases
    CreatePostCommentUseCase,
    CreateCommentReplyUseCase,
    UpdatePostCommentUseCase,
    DeletePostCommentUseCase,
    GetPostCommentsUseCase,
    GetManagementCommentsUseCase,
    CreateManagementCommentUseCase,
    DeleteManagementCommentUseCase,
    // Approval Use Cases
    GetPendingApprovalsUseCase,
    GetPostApprovalHistoryUseCase,
    // Pinning Use Cases
    PinPostUseCase,
    UnpinPostUseCase,
    GetPinnedPostsUseCase,
    // Repositories
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
    {
      provide: "CAMPUS_SETTING_REPOSITORY",
      useClass: PrismaCampusSettingRepository,
    },
    {
      provide: "POST_CATEGORY_REPOSITORY",
      useClass: PrismaPostCategoryRepository,
    },
    {
      provide: "POST_REACTION_REPOSITORY",
      useClass: PrismaPostReactionRepository,
    },
    {
      provide: "POST_COMMENT_REPOSITORY",
      useClass: PrismaPostCommentRepository,
    },
    {
      provide: "POST_APPROVAL_REQUEST_REPOSITORY",
      useClass: PrismaPostApprovalRequestRepository,
    },
  ],
  exports: [
    "POST_REPOSITORY",
    "ATTACHMENT_REPOSITORY",
    "POST_HISTORY_STATUS_REPOSITORY",
    "CAMPUS_SETTING_REPOSITORY",
    "POST_CATEGORY_REPOSITORY",
    "POST_REACTION_REPOSITORY",
    "POST_COMMENT_REPOSITORY",
    "POST_APPROVAL_REQUEST_REPOSITORY",
  ],
})
export class ContentManagementModule {}
