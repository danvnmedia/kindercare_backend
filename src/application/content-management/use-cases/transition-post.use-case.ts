import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import { Post } from "@/domain/content-management/entities/post.entity";
import { PostTransitionAction } from "@/domain/content-management/enums";
import { User } from "@/domain/user-management/user.entity";

import { ApprovePostUseCase } from "./approve-post.use-case";
import { ArchivePostUseCase } from "./archive-post.use-case";
import { PublishPostUseCase } from "./publish-post.use-case";
import { RejectPostUseCase } from "./reject-post.use-case";
import { RevisePostUseCase } from "./revise-post.use-case";
import { SubmitForReviewUseCase } from "./submit-for-review.use-case";
import {
  getRequiredPostTransitionPermission,
  userHasPostPermission,
} from "./authorization/post-permission.helper";

@Injectable()
export class TransitionPostUseCase {
  constructor(
    private readonly approvePostUseCase: ApprovePostUseCase,
    private readonly archivePostUseCase: ArchivePostUseCase,
    private readonly publishPostUseCase: PublishPostUseCase,
    private readonly rejectPostUseCase: RejectPostUseCase,
    private readonly revisePostUseCase: RevisePostUseCase,
    private readonly submitForReviewUseCase: SubmitForReviewUseCase,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    action: PostTransitionAction,
    user: User,
    comment?: string,
  ): Promise<Post> {
    const requiredPermission = getRequiredPostTransitionPermission(action);
    if (!requiredPermission) {
      throw new BadRequestException("Invalid post transition action");
    }
    if (!userHasPostPermission(user, campusId, requiredPermission)) {
      throw new ForbiddenException(
        `You do not have permission to ${action} posts`,
      );
    }

    switch (action) {
      case PostTransitionAction.APPROVE:
        return this.approvePostUseCase.execute(campusId, postId, user, comment);
      case PostTransitionAction.ARCHIVE:
        return this.archivePostUseCase.execute(campusId, postId, user, comment);
      case PostTransitionAction.PUBLISH:
        return this.publishPostUseCase.execute(campusId, postId, user, comment);
      case PostTransitionAction.REJECT:
        return this.rejectPostUseCase.execute(
          campusId,
          postId,
          user,
          comment ?? "",
        );
      case PostTransitionAction.REVISE:
        return this.revisePostUseCase.execute(campusId, postId, user, comment);
      case PostTransitionAction.SUBMIT:
        return this.submitForReviewUseCase.execute(
          campusId,
          postId,
          user,
          comment,
        );
      default:
        throw new BadRequestException("Invalid post transition action");
    }
  }
}
