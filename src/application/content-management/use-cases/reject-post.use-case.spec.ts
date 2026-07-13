import { Logger } from "@nestjs/common";

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

import { RejectPostUseCase } from "./reject-post.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const REVIEWER_ID = "55555555-5555-4555-a555-555555555555";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function pendingPost(): Post {
  const post = Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      title: "Submitted title",
      content: { type: "doc" },
    },
    POST_ID,
  );
  post.submitForReview();
  return post;
}

function pendingRequest(): PostApprovalRequest {
  return PostApprovalRequest.create({
    postId: POST_ID,
    submittedById: AUTHOR_ID,
    titleSnapshot: "Submitted title",
    contentSnapshot: { type: "doc" },
  });
}

describe("RejectPostUseCase", () => {
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
  let useCase: RejectPostUseCase;

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
    useCase = new RejectPostUseCase(unitOfWork);
  });

  afterEach(() => jest.restoreAllMocks());

  it("atomically rejects the request and returns the post to draft", async () => {
    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      reviewer,
      "Needs clearer dates",
    );

    expect(result.status).toBe(PostStatus.DRAFT);
    expect(tx.updatePostApprovalRequestIfPending).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewedById: REVIEWER_ID,
        reviewNote: "Needs clearer dates",
      }),
    );
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PostStatus.PENDING_REVIEW,
        newStatus: PostStatus.DRAFT,
        reason: "Needs clearer dates",
      }),
    );
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "REJECT_POST" }),
    );
  });

  it("rejects blank comments before opening a transaction", async () => {
    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, reviewer, "  "),
    ).rejects.toThrow("A comment is required");
    expect(tx.findPostByIdForUpdate).not.toHaveBeenCalled();
  });

  it("propagates audit failure after all workflow writes", async () => {
    tx.recordAudit.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, reviewer, "Needs changes"),
    ).rejects.toThrow("audit unavailable");
    expect(tx.updatePostApprovalRequestIfPending).toHaveBeenCalledTimes(1);
    expect(tx.updatePost).toHaveBeenCalledTimes(1);
    expect(tx.createPostHistoryStatus).toHaveBeenCalledTimes(1);
  });
});
