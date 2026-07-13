import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PostCommentType } from "@/domain/content-management/entities/post-comment.entity";
import { PrismaService } from "../prisma.service";
import { PrismaPostCommentRepository } from "./prisma-post-comment.repository";

const POST_ID = "44444444-4444-4444-a444-444444444444";

describe("PrismaPostCommentRepository", () => {
  let count: jest.Mock;
  let queryService: jest.Mocked<PrismaQueryService>;
  let repository: PrismaPostCommentRepository;

  beforeEach(() => {
    count = jest.fn().mockResolvedValue(5);
    queryService = {
      executeQuery: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    } as unknown as jest.Mocked<PrismaQueryService>;
    repository = new PrismaPostCommentRepository(
      { postComment: { count } } as unknown as PrismaService,
      queryService,
    );
  });

  it("counts PUBLIC comments including deleted PUBLIC comments", async () => {
    await expect(repository.countPublicByPost(POST_ID)).resolves.toBe(5);

    expect(count).toHaveBeenCalledWith({
      where: {
        postId: POST_ID,
        commentType: PostCommentType.PUBLIC,
      },
    });
  });

  it("uses createdAt then id for deterministic default root pagination", async () => {
    await repository.findRootCommentsByPostId(POST_ID, {});

    expect(queryService.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      "postComment",
      expect.anything(),
      expect.objectContaining({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      expect.anything(),
    );
  });

  it.each([
    [{ sort: "-updatedAt" }, [{ updatedAt: "desc" }, { id: "asc" }]],
    [
      { sortInfo: { sorts: [{ updatedAt: "desc" }] } },
      [{ updatedAt: "desc" }, { id: "asc" }],
    ],
  ] as Array<[StandardRequest, Array<Record<string, string>>]>)(
    "appends id to client sort before querying: %j",
    async (params, expectedOrderBy) => {
      const findMany = jest.fn().mockResolvedValue([]);
      const realCount = jest.fn().mockResolvedValue(0);
      const realRepository = new PrismaPostCommentRepository(
        {
          postComment: { findMany, count: realCount },
        } as unknown as PrismaService,
        new PrismaQueryService(),
      );

      await realRepository.findRootCommentsByPostId(POST_ID, params);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: expectedOrderBy }),
      );
    },
  );
});
