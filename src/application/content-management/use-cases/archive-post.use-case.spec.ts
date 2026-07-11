import { ForbiddenException, Logger } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Post, PostStatus } from "@/domain/content-management";
import {
  DEFAULT_CAMPUS_ID_A,
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

import { ArchivePostUseCase } from "./archive-post.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const USER_ID = "55555555-5555-4555-a555-555555555555";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function publishedPost(): Post {
  const post = Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      title: "Published post",
    },
    POST_ID,
  );
  post.publish();
  post.pin(USER_ID);
  return post;
}

describe("ArchivePostUseCase", () => {
  const author = createUser({ id: AUTHOR_ID });
  const updaterOnly = createUser({
    id: USER_ID,
    roleAssignments: [
      createRoleAssignment(
        createRole({
          permissions: [
            createPermission({ id: "post.update", module: "post" }),
          ],
        }),
        DEFAULT_CAMPUS_ID_A,
      ),
    ],
  });
  let tx: {
    findPostByIdForUpdate: jest.Mock;
    findPendingPostApprovalRequestForUpdate: jest.Mock;
    updatePost: jest.Mock;
    createPostHistoryStatus: jest.Mock;
    recordAudit: jest.Mock;
  };
  let useCase: ArchivePostUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    tx = {
      findPostByIdForUpdate: jest.fn().mockResolvedValue(publishedPost()),
      findPendingPostApprovalRequestForUpdate: jest
        .fn()
        .mockResolvedValue(null),
      updatePost: jest.fn().mockImplementation(async (_id, post) => post),
      createPostHistoryStatus: jest
        .fn()
        .mockImplementation(async (value) => value),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };
    const unitOfWork = {
      run: jest.fn((task) => task(tx as never)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new ArchivePostUseCase(unitOfWork);
  });

  afterEach(() => jest.restoreAllMocks());

  it("lets the author archive atomically and clears pin state", async () => {
    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author);

    expect(result.status).toBe(PostStatus.ARCHIVED);
    expect(result.isPinned).toBe(false);
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ newStatus: PostStatus.ARCHIVED }),
    );
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ARCHIVE_POST" }),
    );
  });

  it("persists an accepted transition comment as the history reason", async () => {
    await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      author,
      "  End of term  ",
    );

    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "End of term" }),
    );
  });

  it("archives a draft through the same atomic path", async () => {
    tx.findPostByIdForUpdate.mockResolvedValue(
      Post.create(
        {
          campusId: DEFAULT_CAMPUS_ID_A,
          authorId: AUTHOR_ID,
          title: "Draft post",
        },
        POST_ID,
      ),
    );

    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author);

    expect(result.status).toBe(PostStatus.ARCHIVED);
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ previousStatus: PostStatus.DRAFT }),
    );
  });

  it("blocks archival while any approval request remains pending", async () => {
    tx.findPendingPostApprovalRequestForUpdate.mockResolvedValue({});

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author),
    ).rejects.toThrow("pending approval request cannot be archived");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("rejects cross-author post.update without post.manage", async () => {
    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, updaterOnly),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.updatePost).not.toHaveBeenCalled();
  });
});
