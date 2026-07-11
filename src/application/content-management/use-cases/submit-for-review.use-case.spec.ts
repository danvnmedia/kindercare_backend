import { Logger } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { CampusSetting, Post, PostStatus } from "@/domain/content-management";
import { DEFAULT_CAMPUS_ID_A, createUser } from "@/test-utils";

import { SubmitForReviewUseCase } from "./submit-for-review.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function draftPost(): Post {
  return Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      title: "Campus update",
      content: { type: "doc", content: [] },
    },
    POST_ID,
  );
}

describe("SubmitForReviewUseCase", () => {
  const currentUser = createUser({ id: AUTHOR_ID });
  let tx: {
    findPostByIdForUpdate: jest.Mock;
    findPendingPostApprovalRequestForUpdate: jest.Mock;
    findCampusSettingByCampusIdForUpdate: jest.Mock;
    updatePost: jest.Mock;
    createPostHistoryStatus: jest.Mock;
    createPostApprovalRequest: jest.Mock;
    recordAudit: jest.Mock;
  };
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let useCase: SubmitForReviewUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    tx = {
      findPostByIdForUpdate: jest.fn().mockResolvedValue(draftPost()),
      findPendingPostApprovalRequestForUpdate: jest
        .fn()
        .mockResolvedValue(null),
      findCampusSettingByCampusIdForUpdate: jest.fn().mockResolvedValue(
        CampusSetting.create({
          campusId: DEFAULT_CAMPUS_ID_A,
          requireTeacherApproval: true,
        }),
      ),
      updatePost: jest.fn().mockImplementation(async (_id, post) => post),
      createPostHistoryStatus: jest
        .fn()
        .mockImplementation(async (value) => value),
      createPostApprovalRequest: jest
        .fn()
        .mockImplementation(async (value) => value),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };
    unitOfWork = {
      run: jest.fn((task) => task(tx as never)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new SubmitForReviewUseCase(unitOfWork);
  });

  afterEach(() => jest.restoreAllMocks());

  it("atomically writes the post, request, history, and audit", async () => {
    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      currentUser,
    );

    expect(result.status).toBe(PostStatus.PENDING_REVIEW);
    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(tx.createPostApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        titleSnapshot: "Campus update",
        contentSnapshot: { type: "doc", content: [] },
      }),
    );
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PostStatus.DRAFT,
        newStatus: PostStatus.PENDING_REVIEW,
      }),
    );
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "SUBMIT_POST_FOR_REVIEW" }),
    );
    expect(tx.updatePost.mock.invocationCallOrder[0]).toBeLessThan(
      tx.createPostApprovalRequest.mock.invocationCallOrder[0],
    );
    expect(
      tx.createPostApprovalRequest.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.recordAudit.mock.invocationCallOrder[0]);
  });

  it("persists an accepted transition comment as the history reason", async () => {
    await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      currentUser,
      "  Please review dates  ",
    );

    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Please review dates" }),
    );
  });

  it("auto-publishes without creating a request when approval is disabled", async () => {
    tx.findCampusSettingByCampusIdForUpdate.mockResolvedValue(
      CampusSetting.create({
        campusId: DEFAULT_CAMPUS_ID_A,
        requireTeacherApproval: false,
      }),
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      currentUser,
    );

    expect(result.status).toBe(PostStatus.PUBLISHED);
    expect(tx.createPostApprovalRequest).not.toHaveBeenCalled();
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: PostStatus.PUBLISHED }),
    );
  });

  it("rejects a draft that already has a pending request", async () => {
    tx.findPendingPostApprovalRequestForUpdate.mockResolvedValue({
      isPending: () => true,
    });

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, currentUser),
    ).rejects.toThrow("already has a pending approval request");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("propagates audit failures so every workflow write rolls back", async () => {
    tx.recordAudit.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, currentUser),
    ).rejects.toThrow("audit unavailable");
    expect(tx.updatePost).toHaveBeenCalledTimes(1);
    expect(tx.createPostApprovalRequest).toHaveBeenCalledTimes(1);
    expect(tx.createPostHistoryStatus).toHaveBeenCalledTimes(1);
  });
});
