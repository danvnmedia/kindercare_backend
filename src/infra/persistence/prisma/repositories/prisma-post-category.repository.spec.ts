import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaService } from "../prisma.service";
import { PrismaPostCategoryRepository } from "./prisma-post-category.repository";

describe("PrismaPostCategoryRepository", () => {
  it("uses deterministic order then id ordering by default", async () => {
    const queryService = {
      executeQuery: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    } as unknown as jest.Mocked<PrismaQueryService>;
    const repository = new PrismaPostCategoryRepository(
      {} as PrismaService,
      queryService,
    );

    await repository.findByCampusId("campus-1", new StandardRequestDto());

    expect(queryService.executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      "postCategory",
      expect.anything(),
      expect.objectContaining({
        orderBy: [{ order: "asc" }, { id: "asc" }],
      }),
      expect.anything(),
    );
  });
});
