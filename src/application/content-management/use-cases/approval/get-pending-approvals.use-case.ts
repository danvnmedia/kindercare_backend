import { Injectable, Inject, ForbiddenException, Logger } from "@nestjs/common";
import { PostApprovalRequestRepository } from "../../ports/post-approval-request.repository";
import { User } from "@/domain/user-management/user.entity";
import { PostApprovalRequest } from "@/domain/content-management";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

@Injectable()
export class GetPendingApprovalsUseCase {
  private readonly logger = new Logger(GetPendingApprovalsUseCase.name);

  constructor(
    @Inject("POST_APPROVAL_REQUEST_REPOSITORY")
    private readonly postApprovalRequestRepository: PostApprovalRequestRepository,
  ) {}

  async execute(
    campusId: string,
    params: StandardRequest,
    currentUser: User,
  ): Promise<PaginatedResult<PostApprovalRequest>> {
    try {
      this.logger.log(`Getting pending approvals for campus: ${campusId}`);

      // Validate admin permission
      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");
      if (!isAdmin) {
        throw new ForbiddenException(
          "Only administrators can view pending approvals",
        );
      }

      const result =
        await this.postApprovalRequestRepository.findPendingByCampus(
          campusId,
          params,
        );

      this.logger.log(`Found ${result.data.length} pending approvals`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to get pending approvals: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
