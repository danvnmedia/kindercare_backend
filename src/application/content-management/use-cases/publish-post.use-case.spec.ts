import { Logger } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { CampusSetting, Post, PostStatus } from "@/domain/content-management";
import {
  DEFAULT_CAMPUS_ID_A,
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

import { PublishPostUseCase } from "./publish-post.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function draftPost(): Post {
  return Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      title: "Draft post",
    },
    POST_ID,
  );
}

describe("PublishPostUseCase", () => {
  const author = createUser({
    id: AUTHOR_ID,
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
    findCampusSettingByCampusIdForUpdate: jest.Mock;
    updatePost: jest.Mock;
    createPostHistoryStatus: jest.Mock;
    recordAudit: jest.Mock;
  };
  let useCase: PublishPostUseCase;

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
          requireTeacherApproval: false,
        }),
      ),
      updatePost: jest.fn().mockImplementation(async (_id, post) => post),
      createPostHistoryStatus: jest
        .fn()
        .mockImplementation(async (value) => value),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };
    const unitOfWork = {
      run: jest.fn((task) => task(tx as never)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new PublishPostUseCase(unitOfWork);
  });

  afterEach(() => jest.restoreAllMocks());

  it("publishes atomically when campus approval is disabled", async () => {
    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author);

    expect(result.status).toBe(PostStatus.PUBLISHED);
    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        previousStatus: PostStatus.DRAFT,
        newStatus: PostStatus.PUBLISHED,
      }),
    );
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PUBLISH_POST" }),
    );
  });

  it("persists an accepted transition comment as the history reason", async () => {
    await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      author,
      "  Ready for families  ",
    );

    expect(tx.createPostHistoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Ready for families" }),
    );
  });

  it("cannot bypass requireTeacherApproval", async () => {
    tx.findCampusSettingByCampusIdForUpdate.mockResolvedValue(
      CampusSetting.create({
        campusId: DEFAULT_CAMPUS_ID_A,
        requireTeacherApproval: true,
      }),
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author),
    ).rejects.toThrow("requires posts to be submitted and approved");
    expect(tx.updatePost).not.toHaveBeenCalled();
  });

  it("blocks direct publish while any request remains pending", async () => {
    tx.findPendingPostApprovalRequestForUpdate.mockResolvedValue({
      isPending: () => true,
    });

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author),
    ).rejects.toThrow("still has a pending approval request");
    expect(tx.findCampusSettingByCampusIdForUpdate).not.toHaveBeenCalled();
  });
});
