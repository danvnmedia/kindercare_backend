import {
  AudienceType,
  Post,
  PostApprovalRequest,
  PostAudience,
} from "@/domain/content-management";
import { createUser, DEFAULT_CAMPUS_ID_A } from "@/test-utils";
import {
  PrismaPostApprovalRequestMapper,
  PrismaPostMapper,
} from "../../mapper";
import { PrismaTransactionClient } from "./base.transaction-ops";
import { ContentManagementTransactionOps } from "./content-management.transaction-ops";

const AUTHOR_ID = "33333333-3333-4333-a333-333333333333";
const MUTATION_ID = "8c05d3f1-7430-42b8-b6cf-9c235af23e15";
const REQUEST_PAYLOAD_HASH = "a".repeat(64);

function createPost(): Post {
  const author = createUser({ id: AUTHOR_ID });
  const post = Post.create({
    campusId: DEFAULT_CAMPUS_ID_A,
    authorId: AUTHOR_ID,
    author,
    title: "Campus update",
  });
  post.setAudiences([
    PostAudience.create({
      postId: post.id,
      campusId: DEFAULT_CAMPUS_ID_A,
      audienceType: AudienceType.ALL,
      audienceId: DEFAULT_CAMPUS_ID_A,
    }),
  ]);
  return post;
}

describe("ContentManagementTransactionOps post idempotency", () => {
  let tx: {
    $queryRaw: jest.Mock;
    post: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };
  let ops: ContentManagementTransactionOps;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      post: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    ops = new ContentManagementTransactionOps(
      tx as unknown as PrismaTransactionClient,
    );
    jest.restoreAllMocks();
  });

  it("looks up mutation keys with campus and author scope", async () => {
    tx.post.findFirst.mockResolvedValue(null);

    await ops.findPostByClientMutationId(
      DEFAULT_CAMPUS_ID_A,
      AUTHOR_ID,
      MUTATION_ID,
    );

    expect(tx.post.findFirst).toHaveBeenCalledWith({
      where: {
        campusId: DEFAULT_CAMPUS_ID_A,
        authorId: AUTHOR_ID,
        clientMutationId: MUTATION_ID,
      },
      include: expect.any(Object),
    });
  });

  it("returns the existing post without creating another row", async () => {
    const existing = createPost();
    jest.spyOn(PrismaPostMapper, "toDomain").mockReturnValue(existing);
    tx.post.findFirst.mockResolvedValue({
      id: existing.id,
      requestPayloadHash: REQUEST_PAYLOAD_HASH,
    });

    const result = await ops.createPostIdempotently(createPost(), {
      clientMutationId: MUTATION_ID,
      requestPayloadHash: REQUEST_PAYLOAD_HASH,
    });

    expect(result).toEqual({
      post: existing,
      requestPayloadHash: REQUEST_PAYLOAD_HASH,
      created: false,
    });
    expect(tx.post.create).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.calls[0][0].join("")).toContain("::text");
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(
      `${DEFAULT_CAMPUS_ID_A}:${AUTHOR_ID}:${MUTATION_ID}`,
    );
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.post.findFirst.mock.invocationCallOrder[0],
    );
  });

  it("persists the mutation key when no scoped post exists", async () => {
    const post = createPost();
    jest.spyOn(PrismaPostMapper, "toDomain").mockReturnValue(post);
    tx.post.findFirst.mockResolvedValue(null);
    tx.post.create.mockResolvedValue({ id: post.id });

    const result = await ops.createPostIdempotently(post, {
      clientMutationId: MUTATION_ID,
      requestPayloadHash: REQUEST_PAYLOAD_HASH,
      categoryIds: [],
    });

    expect(result).toEqual({
      post,
      requestPayloadHash: REQUEST_PAYLOAD_HASH,
      created: true,
    });
    expect(tx.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientMutationId: MUTATION_ID,
          requestPayloadHash: REQUEST_PAYLOAD_HASH,
        }),
      }),
    );
    expect(tx.post.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      tx.post.create.mock.invocationCallOrder[0],
    );
  });
});

describe("ContentManagementTransactionOps audience persistence", () => {
  let tx: {
    post: { update: jest.Mock };
  };
  let ops: ContentManagementTransactionOps;

  beforeEach(() => {
    tx = {
      post: { update: jest.fn() },
    };
    ops = new ContentManagementTransactionOps(
      tx as unknown as PrismaTransactionClient,
    );
    jest.restoreAllMocks();
  });

  it("preserves audiences when a post save does not replace them", async () => {
    const post = createPost();
    jest.spyOn(PrismaPostMapper, "toDomain").mockReturnValue(post);
    tx.post.update.mockResolvedValue({ id: post.id });

    await ops.updatePost(post.id, post);

    expect(tx.post.update.mock.calls[0][0].data).not.toHaveProperty(
      "audiences",
    );
  });

  it("replaces audiences when explicitly requested", async () => {
    const post = createPost();
    jest.spyOn(PrismaPostMapper, "toDomain").mockReturnValue(post);
    tx.post.update.mockResolvedValue({ id: post.id });

    await ops.updatePost(post.id, post, { replaceAudiences: true });

    expect(tx.post.update.mock.calls[0][0].data.audiences).toEqual({
      deleteMany: {},
      create: post.audiences.map((audience) =>
        PrismaPostMapper.toPrismaPostAudienceCreate(audience),
      ),
    });
  });
});

describe("ContentManagementTransactionOps workflow locking", () => {
  let tx: {
    $queryRaw: jest.Mock;
    post: { findUnique: jest.Mock };
    postApprovalRequest: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    campusSetting: { findUnique: jest.Mock };
  };
  let ops: ContentManagementTransactionOps;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn(),
      post: { findUnique: jest.fn() },
      postApprovalRequest: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      campusSetting: { findUnique: jest.fn() },
    };
    ops = new ContentManagementTransactionOps(
      tx as unknown as PrismaTransactionClient,
    );
    jest.restoreAllMocks();
  });

  it("locks a post row before hydrating the aggregate", async () => {
    const post = createPost();
    jest.spyOn(PrismaPostMapper, "toDomain").mockReturnValue(post);
    tx.$queryRaw.mockResolvedValue([{ id: post.id }]);
    tx.post.findUnique.mockResolvedValue({ id: post.id });

    await expect(ops.findPostByIdForUpdate(post.id)).resolves.toBe(post);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.post.findUnique.mock.invocationCallOrder[0],
    );
  });

  it("locks and hydrates the deterministic latest approval request", async () => {
    const request = PostApprovalRequest.create({
      postId: "44444444-4444-4444-a444-444444444444",
      submittedById: AUTHOR_ID,
      titleSnapshot: "Campus update",
    });
    jest
      .spyOn(PrismaPostApprovalRequestMapper, "toDomain")
      .mockReturnValue(request);
    tx.$queryRaw.mockResolvedValue([{ id: request.id }]);
    tx.postApprovalRequest.findUnique.mockResolvedValue({ id: request.id });

    await expect(
      ops.findLatestPostApprovalRequestForUpdate(request.postId),
    ).resolves.toBe(request);

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.postApprovalRequest.findUnique.mock.invocationCallOrder[0],
    );
  });

  it("locks stale pending requests even when they are not the latest overall", async () => {
    const request = PostApprovalRequest.create({
      postId: "44444444-4444-4444-a444-444444444444",
      submittedById: AUTHOR_ID,
      titleSnapshot: "Campus update",
    });
    jest
      .spyOn(PrismaPostApprovalRequestMapper, "toDomain")
      .mockReturnValue(request);
    tx.$queryRaw.mockResolvedValue([{ id: request.id }]);
    tx.postApprovalRequest.findUnique.mockResolvedValue({ id: request.id });

    await expect(
      ops.findPendingPostApprovalRequestForUpdate(request.postId),
    ).resolves.toBe(request);

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.postApprovalRequest.findUnique.mock.invocationCallOrder[0],
    );
  });

  it("uses a pending-state CAS for review decisions", async () => {
    const request = PostApprovalRequest.create({
      postId: "44444444-4444-4444-a444-444444444444",
      submittedById: AUTHOR_ID,
      titleSnapshot: "Campus update",
    });
    request.approve(AUTHOR_ID);
    jest
      .spyOn(PrismaPostApprovalRequestMapper, "toDomain")
      .mockReturnValue(request);
    tx.postApprovalRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.postApprovalRequest.findUnique.mockResolvedValue({ id: request.id });

    await ops.updatePostApprovalRequestIfPending(request);

    expect(tx.postApprovalRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: request.id, status: "PENDING" },
        data: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
  });

  it("fails a losing concurrent review decision", async () => {
    const request = PostApprovalRequest.create({
      postId: "44444444-4444-4444-a444-444444444444",
      submittedById: AUTHOR_ID,
      titleSnapshot: "Campus update",
    });
    request.reject(AUTHOR_ID, "No");
    tx.postApprovalRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      ops.updatePostApprovalRequestIfPending(request),
    ).rejects.toThrow("no longer pending");
    expect(tx.postApprovalRequest.findUnique).not.toHaveBeenCalled();
  });
});
