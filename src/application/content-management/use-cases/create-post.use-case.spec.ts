import { createHash } from "crypto";
import { ConflictException, Logger } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import { AudienceType, Post, PostStatus } from "@/domain/content-management";
import { DEFAULT_CAMPUS_ID_A, createUser } from "@/test-utils/entity-factories";

import { PostCategoryRepository } from "../ports/post-category.repository";
import { CreatePostInput, CreatePostUseCase } from "./create-post.use-case";

const MUTATION_ID = "8c05d3f1-7430-42b8-b6cf-9c235af23e15";
const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";

const input = (overrides: Partial<CreatePostInput> = {}): CreatePostInput => ({
  campusId: DEFAULT_CAMPUS_ID_A,
  clientMutationId: MUTATION_ID,
  title: "Campus update",
  content: { type: "doc", content: [] },
  audiences: [{ audienceType: AudienceType.ALL }],
  ...overrides,
});

const requestHash = (overrides: Partial<CreatePostInput> = {}): string => {
  const request = input(overrides);
  const canonicalPayload = JSON.stringify({
    audiences: request.audiences.map((audience) => ({
      audienceId:
        audience.audienceType === AudienceType.ALL
          ? request.campusId
          : audience.audienceId,
      audienceType: audience.audienceType,
    })),
    campusId: request.campusId,
    categoryIds: request.categoryIds?.slice().sort() ?? null,
    content: { content: [], type: "doc" },
    publishAt: request.publishAt?.toISOString() ?? null,
    title: request.title.trim(),
  });
  return createHash("sha256").update(canonicalPayload).digest("hex");
};

describe("CreatePostUseCase", () => {
  const currentUser = createUser({ id: AUTHOR_ID });
  let userRepository: jest.Mocked<UserRepository>;
  let classRepository: jest.Mocked<ClassRepository>;
  let postCategoryRepository: jest.Mocked<PostCategoryRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let tx: {
    findPostByClientMutationId: jest.Mock;
    createPostIdempotently: jest.Mock;
    recordAudit: jest.Mock;
  };
  let useCase: CreatePostUseCase;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation();
    jest.spyOn(Logger.prototype, "error").mockImplementation();
    userRepository = {
      findById: jest.fn().mockResolvedValue(currentUser),
    } as unknown as jest.Mocked<UserRepository>;
    classRepository = {
      findByIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ClassRepository>;
    postCategoryRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<PostCategoryRepository>;
    tx = {
      findPostByClientMutationId: jest.fn().mockResolvedValue(null),
      createPostIdempotently: jest.fn(),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };
    unitOfWork = {
      run: jest.fn((task) => task(tx as never)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    useCase = new CreatePostUseCase(
      userRepository,
      classRepository,
      postCategoryRepository,
      unitOfWork,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("replays the existing post when the scoped key and payload hash match", async () => {
    const existing = Post.create(
      {
        campusId: DEFAULT_CAMPUS_ID_A,
        authorId: AUTHOR_ID,
        author: currentUser,
        title: "Campus update",
        status: PostStatus.DRAFT,
      },
      "44444444-4444-4444-a444-444444444444",
    );
    tx.findPostByClientMutationId.mockResolvedValue({
      post: existing,
      requestPayloadHash: requestHash(),
    });

    const result = await useCase.execute(input(), currentUser);

    expect(result).toBe(existing);
    expect(tx.findPostByClientMutationId).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      AUTHOR_ID,
      MUTATION_ID,
    );
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(classRepository.findByIds).not.toHaveBeenCalled();
    expect(postCategoryRepository.findById).not.toHaveBeenCalled();
    expect(tx.createPostIdempotently).not.toHaveBeenCalled();
    expect(tx.recordAudit).not.toHaveBeenCalled();
  });

  it("replays semantically identical unordered category sets", async () => {
    const existing = Post.create({
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      author: currentUser,
      title: "Campus update",
    });
    tx.findPostByClientMutationId.mockResolvedValue({
      post: existing,
      requestPayloadHash: requestHash({
        categoryIds: ["category-a", "category-b"],
      }),
    });

    await expect(
      useCase.execute(
        input({ categoryIds: ["category-b", "category-a"] }),
        currentUser,
      ),
    ).resolves.toBe(existing);
    expect(postCategoryRepository.findById).not.toHaveBeenCalled();
  });

  it("returns 409 before downstream calls when a key is reused for another payload", async () => {
    const existing = Post.create({
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      author: currentUser,
      title: "Campus update",
    });
    tx.findPostByClientMutationId.mockResolvedValue({
      post: existing,
      requestPayloadHash: requestHash(),
    });

    const execution = useCase.execute(
      input({ title: "Different update" }),
      currentUser,
    );

    await expect(execution).rejects.toBeInstanceOf(ConflictException);
    await expect(execution).rejects.toMatchObject({ status: 409 });
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(classRepository.findByIds).not.toHaveBeenCalled();
    expect(postCategoryRepository.findById).not.toHaveBeenCalled();
    expect(tx.createPostIdempotently).not.toHaveBeenCalled();
    expect(tx.recordAudit).not.toHaveBeenCalled();
  });

  it("rejects mixed school-wide and class audiences before opening a transaction", async () => {
    await expect(
      useCase.execute(
        input({
          audiences: [
            { audienceType: AudienceType.ALL },
            {
              audienceType: AudienceType.CLASS,
              audienceId: "44444444-4444-4444-a444-444444444444",
            },
          ],
        }),
        currentUser,
      ),
    ).rejects.toThrow("cannot be combined");
    expect(unitOfWork.run).not.toHaveBeenCalled();
  });

  it("normalizes a supplied ALL audience ID in the idempotency hash", async () => {
    const existing = Post.create({
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      author: currentUser,
      title: "Campus update",
    });
    tx.findPostByClientMutationId.mockResolvedValue({
      post: existing,
      requestPayloadHash: requestHash(),
    });

    await expect(
      useCase.execute(
        input({
          audiences: [
            {
              audienceType: AudienceType.ALL,
              audienceId: "44444444-4444-4444-a444-444444444444",
            },
          ],
        }),
        currentUser,
      ),
    ).resolves.toBe(existing);
  });

  it("creates and audits a new post in one unit-of-work callback", async () => {
    tx.createPostIdempotently.mockImplementation(async (post: Post) => ({
      post,
      created: true,
    }));

    const result = await useCase.execute(input(), currentUser);

    expect(result.title).toBe("Campus update");
    expect(tx.createPostIdempotently).toHaveBeenCalledWith(result, {
      categoryIds: undefined,
      clientMutationId: MUTATION_ID,
      requestPayloadHash: requestHash(),
    });
    expect(tx.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: AUTHOR_ID,
        action: "CREATE_POST",
        targetType: "post",
        targetId: result.id,
        campusId: DEFAULT_CAMPUS_ID_A,
      }),
    );
    expect(unitOfWork.run).toHaveBeenCalledTimes(2);
    const createCall = tx.createPostIdempotently.mock.invocationCallOrder[0];
    const auditCall = tx.recordAudit.mock.invocationCallOrder[0];
    expect(createCall).toBeLessThan(auditCall);
  });

  it("does not emit another audit when a competing request created the post", async () => {
    const existing = Post.create(
      {
        campusId: DEFAULT_CAMPUS_ID_A,
        authorId: AUTHOR_ID,
        author: currentUser,
        title: "Winner",
      },
      "55555555-5555-4555-a555-555555555555",
    );
    tx.createPostIdempotently.mockResolvedValue({
      post: existing,
      requestPayloadHash: requestHash(),
      created: false,
    });

    const result = await useCase.execute(input(), currentUser);

    expect(result).toBe(existing);
    expect(tx.recordAudit).not.toHaveBeenCalled();
  });

  it("returns 409 without auditing when a competing request used another payload", async () => {
    const existing = Post.create({
      campusId: DEFAULT_CAMPUS_ID_A,
      authorId: AUTHOR_ID,
      author: currentUser,
      title: "Winner",
    });
    tx.createPostIdempotently.mockResolvedValue({
      post: existing,
      requestPayloadHash: requestHash({ title: "Winner" }),
      created: false,
    });

    await expect(useCase.execute(input(), currentUser)).rejects.toMatchObject({
      status: 409,
    });
    expect(tx.recordAudit).not.toHaveBeenCalled();
  });

  it("propagates audit failures so the unit of work can roll back creation", async () => {
    tx.createPostIdempotently.mockImplementation(async (post: Post) => ({
      post,
      created: true,
    }));
    tx.recordAudit.mockRejectedValue(new Error("audit unavailable"));

    await expect(useCase.execute(input(), currentUser)).rejects.toThrow(
      "audit unavailable",
    );
  });
});
