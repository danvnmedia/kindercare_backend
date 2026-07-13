import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";

import { Post } from "@/domain/content-management";
import { PostTransitionAction } from "@/domain/content-management/enums";
import {
  DEFAULT_CAMPUS_ID_A,
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

import { BatchTransitionPostUseCase } from "./batch-transition-post.use-case";
import { TransitionPostUseCase } from "./transition-post.use-case";

const USER_ID = "33333333-3333-4333-a333-333333333333";
const POST_ID_A = "44444444-4444-4444-a444-444444444444";
const POST_ID_B = "55555555-5555-4555-a555-555555555555";

function post(id: string): Post {
  return Post.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: USER_ID,
      title: id,
    },
    id,
  );
}

describe("BatchTransitionPostUseCase", () => {
  const user = createUser({
    id: USER_ID,
    roleAssignments: [
      createRoleAssignment(
        createRole({
          permissions: [
            createPermission({ id: "post.update", module: "post" }),
            createPermission({ id: "post.review", module: "post" }),
          ],
        }),
        DEFAULT_CAMPUS_ID_A,
      ),
    ],
  });
  let transitionPostUseCase: { execute: jest.Mock };
  let useCase: BatchTransitionPostUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    transitionPostUseCase = { execute: jest.fn() };
    useCase = new BatchTransitionPostUseCase(
      transitionPostUseCase as unknown as TransitionPostUseCase,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it("deduplicates IDs in first-seen order and reports partial failures", async () => {
    transitionPostUseCase.execute.mockImplementation(
      async (_campusId, postId) => {
        if (postId === POST_ID_B) {
          throw new NotFoundException(`Post with ID ${postId} not found`);
        }
        return post(postId);
      },
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      [POST_ID_A, POST_ID_A, POST_ID_B],
      PostTransitionAction.PUBLISH,
      user,
    );

    expect(transitionPostUseCase.execute).toHaveBeenCalledTimes(2);
    expect(
      transitionPostUseCase.execute.mock.calls.map((call) => call[1]),
    ).toEqual([POST_ID_A, POST_ID_B]);
    expect(result).toMatchObject({ total: 2, succeeded: 1, failed: 1 });
    expect(result.results[0]).toMatchObject({
      postId: POST_ID_A,
      success: true,
    });
    expect(result.results[1]).toEqual({
      postId: POST_ID_B,
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Post with ID ${POST_ID_B} not found`,
        statusCode: 404,
      },
    });
  });

  it("accepts exactly 100 unique post IDs", async () => {
    const postIds = Array.from(
      { length: 100 },
      (_, index) =>
        `${String(index).padStart(8, "0")}-0000-4000-a000-000000000000`,
    );
    transitionPostUseCase.execute.mockResolvedValue(post(POST_ID_A));

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      postIds,
      PostTransitionAction.PUBLISH,
      user,
    );

    expect(result).toMatchObject({ total: 100, succeeded: 100, failed: 0 });
    expect(transitionPostUseCase.execute).toHaveBeenCalledTimes(100);
  });

  it("enforces the maximum against submitted IDs before deduplication", async () => {
    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        Array.from({ length: 101 }, () => POST_ID_A),
        PostTransitionAction.PUBLISH,
        user,
      ),
    ).rejects.toThrow("Batch transitions are limited to 100 posts");

    expect(transitionPostUseCase.execute).not.toHaveBeenCalled();
  });

  it("maps revise to post.update instead of post.review", async () => {
    const reviewerOnly = createUser({
      id: USER_ID,
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

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        [POST_ID_A],
        PostTransitionAction.REVISE,
        reviewerOnly,
      ),
    ).rejects.toThrow("permission to revise posts");
    expect(transitionPostUseCase.execute).not.toHaveBeenCalled();
  });

  it("rejects unknown actions before processing any post", async () => {
    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        [POST_ID_A],
        "unknown" as PostTransitionAction,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transitionPostUseCase.execute).not.toHaveBeenCalled();
  });

  it("rejects a blank batch rejection comment before processing any post", async () => {
    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        [POST_ID_A, POST_ID_B],
        PostTransitionAction.REJECT,
        user,
        "   ",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transitionPostUseCase.execute).not.toHaveBeenCalled();
  });

  it("preserves safe structured HttpException details", async () => {
    transitionPostUseCase.execute.mockRejectedValue(
      new ConflictException({
        code: "POST_STATE_CONFLICT",
        message: "Post status changed before transition",
        currentStatus: "ARCHIVED",
      }),
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      [POST_ID_A],
      PostTransitionAction.PUBLISH,
      user,
    );

    expect(result.results[0].error).toEqual({
      code: "POST_STATE_CONFLICT",
      message: "Post status changed before transition",
      statusCode: 409,
    });
  });

  it.each([
    [new Error("database password=secret"), "database password=secret"],
    [
      new ServiceUnavailableException("internal dependency URL is private"),
      "internal dependency URL is private",
    ],
  ])("redacts unexpected server failure details", async (failure, secret) => {
    transitionPostUseCase.execute.mockRejectedValue(failure);

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      [POST_ID_A],
      PostTransitionAction.PUBLISH,
      user,
    );

    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.results[0].error).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to transition post",
      statusCode: 500,
    });
  });
});
