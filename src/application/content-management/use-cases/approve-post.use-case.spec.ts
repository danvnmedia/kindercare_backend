import { BadRequestException, Logger } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  Post,
  PostApprovalRequest,
  PostStatus,
} from "@/domain/content-management";
import {
  DEFAULT_CAMPUS_ID_A,
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

import { ApprovePostUseCase } from "./approve-post.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const REVIEWER_ID = "55555555-5555-4555-a555-555555555555";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function pendingPost(content: Record<string, unknown> = { type: "doc" }): Post {
  const post = Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      title: "Submitted title",
      content,
    },
    POST_ID,
  );
  post.submitForReview();
  return post;
}

function pendingRequest(
  contentSnapshot: Record<string, unknown> = { type: "doc" },
): PostApprovalRequest {
  return PostApprovalRequest.create({
    postId: POST_ID,
    submittedById: AUTHOR_ID,
    titleSnapshot: "Submitted title",
    contentSnapshot,
  });
}

describe("ApprovePostUseCase", () => {
  const reviewer = createUser({
    id: REVIEWER_ID,
    roleAssignments: [
      createRoleAssignment(
        createRole({
          permissions: [
            createPermission({ id: "post.review", module: "post" }),
          ],
        }),
        DEFAULT_CAMPUS_ID_A,
      ),
    ],
  });
  let tx: {
    findPostByIdForUpdate: jest.Mock;
    findLatestPostApprovalRequestForUpdate: jest.Mock;
    updatePostApprovalRequestIfPending: jest.Mock;
    updatePost: jest.Mock;
    createPostHistoryStatus: jest.Mock;
    recordAudit: jest.Mock;
  };
  let useCase: ApprovePostUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    tx = {
      findPostByIdForUpdate: jest.fn().mockResolvedValue(pendingPost()),
      findLatestPostApprovalRequestForUpdate: jest
        .fn()
        .mockResolvedValue(pendingRequest()),
      updatePostApprovalRequestIfPending: jest
        .fn()
        .mockImplementation(async (value) => value),
      updatePost: jest.fn().mockImplementation(async (_id, post) => post),
      createPostHistoryStatus: jest
        .fn()
        .mockImplementation(async (value) => value),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };
    const unitOfWork = {
      run: jest.fn((task) => task(tx as never)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new ApprovePostUseCase(unitOfWork);
  });

  afterEach(() => jest.restoreAllMocks());

  it("atomically decides the latest pending request and publishes the post", async () => {
    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      reviewer,
    );

    expect(result.status).toBe(PostStatus.PUBLISHED);
    expect(tx.updatePostApprovalRequestIfPending).toHaveBeenCalledWith(
      expect.objectContaining({ reviewedById: REVIEWER_ID }),
    );
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PostStatus.PENDING_REVIEW,
        newStatus: PostStatus.PUBLISHED,
      }),
    );
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "APPROVE_POST" }),
    );
    expect(
      tx.updatePostApprovalRequestIfPending.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.updatePost.mock.invocationCallOrder[0]);
  });

  it("persists an accepted transition comment as the history reason", async () => {
    await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      reviewer,
      "  Reviewed with leadership  ",
    );

    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Reviewed with leadership" }),
    );
  });

  it("blocks approval when the post drifted from the submitted snapshot", async () => {
    tx.findLatestPostApprovalRequestForUpdate.mockResolvedValue(
      pendingRequest({ type: "different" }),
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, reviewer),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.updatePostApprovalRequestIfPending).not.toHaveBeenCalled();
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("requires an actual latest pending request", async () => {
    tx.findLatestPostApprovalRequestForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, reviewer),
    ).rejects.toThrow("missing or no longer pending");
  });

  it("propagates the conditional request-update conflict", async () => {
    tx.updatePostApprovalRequestIfPending.mockRejectedValue(
      new Error("Post approval request is no longer pending"),
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, reviewer),
    ).rejects.toThrow("no longer pending");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });
});
