import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { CampusSetting, Post, PostStatus } from "@/domain/content-management";
import {
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";
import { PinPostUseCase } from "./pin-post.use-case";

const POST_ID = "22222222-2222-4222-a222-222222222222";
const ACTOR_ID = "33333333-3333-4333-a333-333333333333";

function post(status = PostStatus.PUBLISHED, isDeleted = false): Post {
  return Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: ACTOR_ID,
      title: "Campus update",
      status,
      isDeleted,
    },
    POST_ID,
  );
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

describe("PinPostUseCase", () => {
  let tx: jest.Mocked<TransactionContext>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let useCase: PinPostUseCase;

  beforeEach(() => {
    tx = {
      lockPostPinCapacity: jest.fn().mockResolvedValue(undefined),
      findPostByIdForUpdate: jest.fn().mockResolvedValue(post()),
      findCampusSettingByCampusIdForUpdate: jest.fn().mockResolvedValue(
        CampusSetting.create({ campusId: DEFAULT_CAMPUS_ID_A, maxPinnedPosts: 3 }),
      ),
      countEffectivePinnedPosts: jest.fn().mockResolvedValue(1),
      updatePostPin: jest.fn().mockImplementation(async (_id, data) => {
        const value = post();
        value.pin(data.pinnedById as string, data.pinnedUntil);
        return value;
      }),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(tx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new PinPostUseCase(unitOfWork);
  });

  it("serializes capacity, locks the row, counts, then applies a pin-only patch", async () => {
    const pinnedUntil = new Date(Date.now() + 60_000);
    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      POST_ID,
      { pinnedUntil },
      manager,
    );

    expect(result.isPinned).toBe(true);
    expect(tx.updatePostPin).toHaveBeenCalledWith(POST_ID, {
      isPinned: true,
      pinnedById: ACTOR_ID,
      pinnedUntil,
    });
    expect(tx.lockPostPinCapacity.mock.invocationCallOrder[0]).toBeLessThan(
      tx.findPostByIdForUpdate.mock.invocationCallOrder[0],
    );
    expect(tx.countEffectivePinnedPosts.mock.invocationCallOrder[0]).toBeLessThan(
      tx.updatePostPin.mock.invocationCallOrder[0],
    );
  });

  it("enforces maximum capacity without writing", async () => {
    tx.countEffectivePinnedPosts.mockResolvedValue(3);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, {}, manager),
    ).rejects.toThrow(BadRequestException);
    expect(tx.updatePostPin).not.toHaveBeenCalled();
  });

  it.each([PostStatus.DRAFT, PostStatus.PENDING_REVIEW, PostStatus.ARCHIVED])(
    "rejects %s posts under the row lock",
    async (status) => {
      tx.findPostByIdForUpdate.mockResolvedValue(post(status));

      await expect(
        useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, {}, manager),
      ).rejects.toThrow(BadRequestException);
      expect(tx.countEffectivePinnedPosts).not.toHaveBeenCalled();
      expect(tx.updatePostPin).not.toHaveBeenCalled();
    },
  );

  it("treats deleted posts as absent", async () => {
    tx.findPostByIdForUpdate.mockResolvedValue(null);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, POST_ID, {}, manager),
    ).rejects.toThrow(NotFoundException);
    expect(tx.updatePostPin).not.toHaveBeenCalled();
  });

  it("rejects expired pin deadlines", async () => {
    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        POST_ID,
        { pinnedUntil: new Date(0) },
        manager,
      ),
    ).rejects.toThrow("Pin expiration must be in the future");
    expect(tx.updatePostPin).not.toHaveBeenCalled();
  });
});
