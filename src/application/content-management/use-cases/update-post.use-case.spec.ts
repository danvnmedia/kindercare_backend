import { ForbiddenException, Logger } from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { AudienceType, Post, PostStatus } from "@/domain/content-management";
import {
  DEFAULT_CAMPUS_ID_A,
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

import { PostCategoryRepository } from "../ports/post-category.repository";
import { UpdatePostUseCase } from "./update-post.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const MANAGER_ID = "55555555-5555-4555-a555-555555555555";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function postWithStatus(status: PostStatus): Post {
  const post = Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      title: "Original title",
      content: { type: "doc" },
    },
    POST_ID,
  );
  if (status === PostStatus.PENDING_REVIEW) post.submitForReview();
  if (status === PostStatus.PUBLISHED) {
    post.publish();
    post.pin(MANAGER_ID);
  }
  if (status === PostStatus.ARCHIVED) post.archive();
  return post;
}

describe("UpdatePostUseCase", () => {
  const author = createUser({ id: AUTHOR_ID });
  const manager = createUser({
    id: MANAGER_ID,
    roleAssignments: [
      createRoleAssignment(
        createRole({
          permissions: [
            createPermission({ id: "post.manage", module: "post" }),
          ],
        }),
        DEFAULT_CAMPUS_ID_A,
      ),
    ],
  });
  const updaterOnly = createUser({
    id: MANAGER_ID,
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
  let classRepository: jest.Mocked<ClassRepository>;
  let categoryRepository: jest.Mocked<PostCategoryRepository>;
  let tx: {
    findPostByIdForUpdate: jest.Mock;
    findPendingPostApprovalRequestForUpdate: jest.Mock;
    updatePost: jest.Mock;
    createPostHistoryStatus: jest.Mock;
    recordAudit: jest.Mock;
  };
  let useCase: UpdatePostUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    classRepository = {} as jest.Mocked<ClassRepository>;
    categoryRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<PostCategoryRepository>;
    tx = {
      findPostByIdForUpdate: jest
        .fn()
        .mockResolvedValue(postWithStatus(PostStatus.DRAFT)),
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
    useCase = new UpdatePostUseCase(
      classRepository,
      categoryRepository,
      unitOfWork,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it("allows an author to edit a draft without post.manage", async () => {
    const result = await useCase.execute(
      POST_ID,
      { campusId: DEFAULT_CAMPUS_ID_A, title: "Updated title" },
      author,
    );

    expect(result.title).toBe("Updated title");
    expect(result.status).toBe(PostStatus.DRAFT);
    expect(tx.updatePost).toHaveBeenCalledWith(POST_ID, result, {
      categoryIds: undefined,
      replaceAudiences: false,
    });
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE_POST" }),
    );
  });

  it("replaces audiences only when the update explicitly includes them", async () => {
    const existing = postWithStatus(PostStatus.DRAFT);
    tx.findPostByIdForUpdate.mockResolvedValue(existing);

    const result = await useCase.execute(
      POST_ID,
      {
        campusId: DEFAULT_CAMPUS_ID_A,
        expectedUpdatedAt: existing.updatedAt,
        audiences: [{ audienceType: AudienceType.ALL }],
      },
      author,
    );

    expect(tx.updatePost).toHaveBeenCalledWith(POST_ID, result, {
      categoryIds: undefined,
      replaceAudiences: true,
    });
  });

  it.each([
    [[], "at least one audience"],
    [
      [
        { audienceType: AudienceType.ALL },
        {
          audienceType: AudienceType.CLASS,
          audienceId: "44444444-4444-4444-a444-444444444445",
        },
      ],
      "cannot be combined",
    ],
    [
      [
        {
          audienceType: AudienceType.CLASS,
          audienceId: "44444444-4444-4444-a444-444444444445",
        },
        {
          audienceType: AudienceType.CLASS,
          audienceId: "44444444-4444-4444-a444-444444444445",
        },
      ],
      "must not contain duplicates",
    ],
  ])(
    "rejects invalid audience replacements: %s",
    async (audiences, message) => {
      await expect(
        useCase.execute(
          POST_ID,
          {
            campusId: DEFAULT_CAMPUS_ID_A,
            audiences: audiences as NonNullable<
              Parameters<UpdatePostUseCase["execute"]>[1]["audiences"]
            >,
          },
          author,
        ),
      ).rejects.toThrow(message as string);
      expect(tx.updatePost).not.toHaveBeenCalled();
    },
  );

  it("accepts legacy audience replacements without a version token during rollout", async () => {
    await expect(
      useCase.execute(
        POST_ID,
        {
          campusId: DEFAULT_CAMPUS_ID_A,
          audiences: [{ audienceType: AudienceType.ALL }],
        },
        author,
      ),
    ).resolves.toEqual(expect.objectContaining({ status: PostStatus.DRAFT }));
    expect(tx.updatePost).toHaveBeenCalledTimes(1);
  });

  it("rejects null audiences instead of treating them as a no-op", async () => {
    await expect(
      useCase.execute(
        POST_ID,
        {
          campusId: DEFAULT_CAMPUS_ID_A,
          audiences: null,
        } as unknown as Parameters<UpdatePostUseCase["execute"]>[1],
        author,
      ),
    ).rejects.toThrow("at least one audience");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("allows post.manage to edit another author's post", async () => {
    await expect(
      useCase.execute(
        POST_ID,
        { campusId: DEFAULT_CAMPUS_ID_A, title: "Managed title" },
        manager,
      ),
    ).resolves.toEqual(expect.objectContaining({ title: "Managed title" }));
  });

  it("rejects cross-author post.update without post.manage", async () => {
    await expect(
      useCase.execute(
        POST_ID,
        { campusId: DEFAULT_CAMPUS_ID_A, title: "Not allowed" },
        updaterOnly,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("rejects stale edits before changing audiences", async () => {
    const existing = postWithStatus(PostStatus.DRAFT);
    tx.findPostByIdForUpdate.mockResolvedValue(existing);

    await expect(
      useCase.execute(
        POST_ID,
        {
          campusId: DEFAULT_CAMPUS_ID_A,
          expectedUpdatedAt: new Date(existing.updatedAt.getTime() - 1),
          audiences: [{ audienceType: AudienceType.ALL }],
        },
        author,
      ),
    ).rejects.toThrow("Post changed since it was loaded");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("blocks pending-review edits", async () => {
    tx.findPostByIdForUpdate.mockResolvedValue(
      postWithStatus(PostStatus.PENDING_REVIEW),
    );

    await expect(
      useCase.execute(
        POST_ID,
        { campusId: DEFAULT_CAMPUS_ID_A, title: "Drifted title" },
        author,
      ),
    ).rejects.toThrow("Pending-review posts cannot be edited");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("moves a published edit to draft, unpins, and records status history", async () => {
    tx.findPostByIdForUpdate.mockResolvedValue(
      postWithStatus(PostStatus.PUBLISHED),
    );

    const result = await useCase.execute(
      POST_ID,
      { campusId: DEFAULT_CAMPUS_ID_A, title: "Revised publication" },
      author,
    );

    expect(result.status).toBe(PostStatus.DRAFT);
    expect(result.publishAt).toBeNull();
    expect(result.isPinned).toBe(false);
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PostStatus.PUBLISHED,
        newStatus: PostStatus.DRAFT,
      }),
    );
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ requiresResubmission: true }),
      }),
    );
  });

  it("blocks stale pending approval requests even on a draft", async () => {
    tx.findPendingPostApprovalRequestForUpdate.mockResolvedValue({});

    await expect(
      useCase.execute(
        POST_ID,
        { campusId: DEFAULT_CAMPUS_ID_A, title: "Not allowed" },
        author,
      ),
    ).rejects.toThrow("pending approval request cannot be edited");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("rejects empty updates without demoting published content", async () => {
    tx.findPostByIdForUpdate.mockResolvedValue(
      postWithStatus(PostStatus.PUBLISHED),
    );

    await expect(
      useCase.execute(POST_ID, { campusId: DEFAULT_CAMPUS_ID_A }, author),
    ).rejects.toThrow("At least one post field must be updated");
    expect(tx.findPostByIdForUpdate).not.toHaveBeenCalled();
  });

  it("propagates audit failure after update for transaction rollback", async () => {
    tx.recordAudit.mockRejectedValue(new Error("audit unavailable"));

    await expect(
      useCase.execute(
        POST_ID,
        { campusId: DEFAULT_CAMPUS_ID_A, title: "Updated title" },
        author,
      ),
    ).rejects.toThrow("audit unavailable");
    expect(tx.updatePost).toHaveBeenCalledTimes(1);
  });
});
