import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Post, PostStatus } from "@/domain/content-management";
import {
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";
import { UnpinPostUseCase } from "./unpin-post.use-case";

const POST_ID = "22222222-2222-4222-a222-222222222222";
const ACTOR_ID = "33333333-3333-4333-a333-333333333333";

function post(isPinned: boolean): Post {
  const value = Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: ACTOR_ID,
      title: "Campus update",
      status: PostStatus.PUBLISHED,
    },
    POST_ID,
  );
  if (isPinned) value.pin(ACTOR_ID);
  return value;
}

const manager = createUser({
  id: ACTOR_ID,
  roleAssignments: [
    createRoleAssignment(
      createRole({
        campusId: DEFAULT_CAMPUS_ID_A,
        permissions: [createPermission({ id: "post.manage", module: "post" })],
      }),
      DEFAULT_CAMPUS_ID_A,
    ),
  ],
});

describe("UnpinPostUseCase", () => {
  let tx: jest.Mocked<TransactionContext>;
  let useCase: UnpinPostUseCase;

  beforeEach(() => {
    tx = {
      lockPostPinCapacity: jest.fn().mockResolvedValue(undefined),
      findPostByIdForUpdate: jest.fn().mockResolvedValue(post(true)),
      updatePostPin: jest.fn().mockResolvedValue(post(false)),
    } as unknown as jest.Mocked<TransactionContext>;
    const unitOfWork = {
      run: jest.fn((task) => task(tx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new UnpinPostUseCase(unitOfWork);
  });

  it("locks campus then row and clears only pin columns", async () => {
    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, manager);

    expect(result.isPinned).toBe(false);
    expect(tx.updatePostPin).toHaveBeenCalledWith(POST_ID, {
      isPinned: false,
      pinnedById: null,
      pinnedUntil: null,
    });
    expect(tx.lockPostPinCapacity.mock.invocationCallOrder[0]).toBeLessThan(
      tx.findPostByIdForUpdate.mock.invocationCallOrder[0],
    );
  });

  it("returns an already-unpinned locked row without writing", async () => {
    const existing = post(false);
    tx.findPostByIdForUpdate.mockResolvedValue(existing);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, manager),
    ).resolves.toBe(existing);
    expect(tx.updatePostPin).not.toHaveBeenCalled();
  });
});
