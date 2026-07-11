import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Post, PostStatus } from "@/domain/content-management";
import {
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";
import { ConflictException, ForbiddenException, Logger } from "@nestjs/common";
import { DeletePostUseCase } from "./delete-post.use-case";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const OTHER_USER_ID = "55555555-5555-4555-a555-555555555555";
const POST_ID = "44444444-4444-4444-a444-444444444444";

function createPost(status: PostStatus): Post {
  return Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      title: "Campus update",
      status,
    },
    POST_ID,
  );
}

function userWithPermission(id: string, permissionId: string) {
  return createUser({
    id,
    roleAssignments: [
      createRoleAssignment(
        createRole({
          permissions: [createPermission({ id: permissionId, module: "post" })],
        }),
        DEFAULT_CAMPUS_ID_A,
      ),
    ],
  });
}

describe("DeletePostUseCase", () => {
  const author = createUser({ id: AUTHOR_ID });
  const manager = userWithPermission(OTHER_USER_ID, "post.manage");
  const deleteOnly = userWithPermission(OTHER_USER_ID, "post.delete");
  let tx: {
    findPostByIdForUpdate: jest.Mock;
    deletePost: jest.Mock;
    recordAudit: jest.Mock;
  };
  let useCase: DeletePostUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    tx = {
      findPostByIdForUpdate: jest
        .fn()
        .mockResolvedValue(createPost(PostStatus.DRAFT)),
      deletePost: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };
    const unitOfWork = {
      run: jest.fn((task) => task(tx as never)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new DeletePostUseCase(unitOfWork);
  });

  afterEach(() => jest.restoreAllMocks());

  it("lets the author delete under the post lock", async () => {
    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author),
    ).resolves.toBeUndefined();

    expect(tx.findPostByIdForUpdate).toHaveBeenCalledWith(POST_ID);
    expect(tx.deletePost).toHaveBeenCalledWith(POST_ID);
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DELETE_POST", targetId: POST_ID }),
    );
  });

  it("lets post.manage delete another author's post", async () => {
    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, manager),
    ).resolves.toBeUndefined();
    expect(tx.deletePost).toHaveBeenCalledWith(POST_ID);
  });

  it("rejects cross-author post.delete without post.manage", async () => {
    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, deleteOnly),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.deletePost).not.toHaveBeenCalled();
    expect(tx.recordAudit).not.toHaveBeenCalled();
  });

  it("rejects pending-review deletion without orphaning its request", async () => {
    tx.findPostByIdForUpdate.mockResolvedValue(
      createPost(PostStatus.PENDING_REVIEW),
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, author),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.deletePost).not.toHaveBeenCalled();
    expect(tx.recordAudit).not.toHaveBeenCalled();
  });
});
