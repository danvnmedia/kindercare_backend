import {
  Injectable,
  NotFoundException,
  Inject,
  ForbiddenException,
} from "@nestjs/common";
import { PostTransitionAction } from "@/domain/content-management/enums";
import { User } from "@/domain/user-management/user.entity";
import { ApprovePostUseCase } from "./approve-post.use-case";
import { ArchivePostUseCase } from "./archive-post.use-case";
import { PublishPostUseCase } from "./publish-post.use-case";
import { RejectPostUseCase } from "./reject-post.use-case";
import { RevisePostUseCase } from "./revise-post.use-case";
import { SubmitForReviewUseCase } from "./submit-for-review.use-case";
import { PostRepository } from "../ports";
import { Post } from "@/domain/content-management/entities/post.entity";

@Injectable()
export class TransitionPostUseCase {
  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
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
    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new NotFoundException("Post not found");
    }

    // Verify the request campus matches the post's campus
    if (post.campusId !== campusId) {
      throw new ForbiddenException(
        "You do not have access to this post in the specified campus",
      );
    }

    switch (action) {
      case PostTransitionAction.APPROVE:
        return this.approvePostUseCase.execute(campusId, postId, user);
      case PostTransitionAction.ARCHIVE:
        return this.archivePostUseCase.execute(campusId, postId, user);
      case PostTransitionAction.PUBLISH:
        return this.publishPostUseCase.execute(campusId, postId, user);
      case PostTransitionAction.REJECT:
        return this.rejectPostUseCase.execute(
          campusId,
          postId,
          user,
          comment as string,
        );
      case PostTransitionAction.REVISE:
        return this.revisePostUseCase.execute(campusId, postId, user);
      case PostTransitionAction.SUBMIT:
        return this.submitForReviewUseCase.execute(campusId, postId, user);
      default:
        throw new Error("Invalid post transition action");
    }
  }
}
