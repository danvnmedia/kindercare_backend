import { PostReaction } from "@/domain/content-management";

import { PrismaService } from "../prisma.service";
import { PrismaPostReactionRepository } from "./prisma-post-reaction.repository";

const REACTION_ID = "66666666-6666-4666-a666-666666666666";
const POST_ID = "44444444-4444-4444-a444-444444444444";
const USER_ID = "33333333-3333-4333-a333-333333333333";
const CREATED_AT = new Date("2026-07-11T00:00:00.000Z");
const row = {
  id: REACTION_ID,
  postId: POST_ID,
  userId: USER_ID,
  createdAt: CREATED_AT,
};

describe("PrismaPostReactionRepository", () => {
  let delegate: {
    findUnique: jest.Mock;
    count: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
    deleteMany: jest.Mock;
  };
  let repository: PrismaPostReactionRepository;

  beforeEach(() => {
    delegate = {
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    };
    repository = new PrismaPostReactionRepository({
      postReaction: delegate,
    } as unknown as PrismaService);
  });

  it("uses the post-user composite key for lookup", async () => {
    delegate.findUnique.mockResolvedValue(row);

    const result = await repository.findByPostAndUser(POST_ID, USER_ID);

    expect(delegate.findUnique).toHaveBeenCalledWith({
      where: { postId_userId: { postId: POST_ID, userId: USER_ID } },
    });
    expect(result).toMatchObject({ postId: POST_ID, userId: USER_ID });
  });

  it("upserts a heart so concurrent adds converge on one row", async () => {
    delegate.upsert.mockResolvedValue(row);
    const reaction = PostReaction.create(
      { postId: POST_ID, userId: USER_ID, createdAt: CREATED_AT },
      REACTION_ID,
    );

    const result = await repository.save(reaction);

    expect(delegate.upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: POST_ID, userId: USER_ID } },
      create: row,
      update: {},
    });
    expect(result).toMatchObject({ postId: POST_ID, userId: USER_ID });
  });

  it("deletes idempotently by post and user", async () => {
    delegate.deleteMany.mockResolvedValue({ count: 0 });

    await expect(repository.delete(POST_ID, USER_ID)).resolves.toBeUndefined();

    expect(delegate.deleteMany).toHaveBeenCalledWith({
      where: { postId: POST_ID, userId: USER_ID },
    });
  });
});
