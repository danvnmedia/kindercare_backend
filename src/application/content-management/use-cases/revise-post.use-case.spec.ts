import { Logger } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  Post,
  PostApprovalRequest,
  PostStatus,
} from "@/domain/content-management";
import { DEFAULT_CAMPUS_ID_A, createUser } from "@/test-utils";

import { RevisePostUseCase } from "./revise-post.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function postWithStatus(status: PostStatus): Post {
  const post = Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      title: "Submitted title",
      content: { type: "doc" },
    },
    POST_ID,
  );
  if (status === PostStatus.PENDING_REVIEW) post.submitForReview();
  if (status === PostStatus.PUBLISHED) post.publish();
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

describe("RevisePostUseCase", () => {
  const author = createUser({ id: AUTHOR_ID });
  let tx: {
    findPostByIdForUpdate: jest.Mock;
    findLatestPostApprovalRequestForUpdate: jest.Mock;
    updatePostApprovalRequestIfPending: jest.Mock;
    updatePost: jest.Mock;
    createPostHistoryStatus: jest.Mock;
    recordAudit: jest.Mock;
  };
  let useCase: RevisePostUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    tx = {
      findPostByIdForUpdate: jest
        .fn()
        .mockResolvedValue(postWithStatus(PostStatus.PENDING_REVIEW)),
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
    useCase = new RevisePostUseCase(unitOfWork);
  });

  afterEach(() => jest.restoreAllMocks());

  it("closes the pending request before returning the post to draft", async () => {
    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author);

    expect(result.status).toBe(PostStatus.DRAFT);
    expect(tx.updatePostApprovalRequestIfPending).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewNote: "Post revised before approval",
      }),
    );
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PostStatus.PENDING_REVIEW,
        newStatus: PostStatus.DRAFT,
        reason: "Post revised before approval",
      }),
    );
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ workflowAction: "REVISE" }),
      }),
    );
  });

  it("uses an accepted transition comment instead of the default history reason", async () => {
    await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      author,
      "  Author requested changes  ",
    );

    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Author requested changes" }),
    );
  });

  it("revises a published post without touching an approval request", async () => {
    tx.findPostByIdForUpdate.mockResolvedValue(
      postWithStatus(PostStatus.PUBLISHED),
    );

    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author);

    expect(result.status).toBe(PostStatus.DRAFT);
    expect(result.publishAt).toBeNull();
    expect(tx.findLatestPostApprovalRequestForUpdate).not.toHaveBeenCalled();
    expect(tx.updatePostApprovalRequestIfPending).not.toHaveBeenCalled();
  });

  it("blocks pending revision when the latest request is not pending", async () => {
    const decided = pendingRequest();
    decided.approve(AUTHOR_ID);
    tx.findLatestPostApprovalRequestForUpdate.mockResolvedValue(decided);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author),
    ).rejects.toThrow("missing or no longer pending");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });
});
