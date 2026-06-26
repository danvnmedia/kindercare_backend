import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PrismaWeeklyPlanMapper } from "../mapper/prisma-weekly-plan.mapper";
import { PrismaService } from "../prisma.service";
import { PrismaWeeklyPlanRepository } from "./prisma-weekly-plan.repository";

describe("PrismaWeeklyPlanRepository", () => {
  let repository: PrismaWeeklyPlanRepository;
  let queryService: jest.Mocked<PrismaQueryService>;

  beforeEach(() => {
    queryService = {
      executeQuery: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    } as unknown as jest.Mocked<PrismaQueryService>;

    repository = new PrismaWeeklyPlanRepository(
      {} as PrismaService,
      queryService,
    );
  });

  it("findByCampusId routes weekStartDate filters through date-aware Prisma query options", async () => {
    const params = {};

    await repository.findByCampusId(
      "11111111-1111-4111-8111-111111111111",
      params,
    );

    expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
    const [, modelName, passedParams, options, mapper] =
      queryService.executeQuery.mock.calls[0];
    const queryOptions = options as Record<string, any>;

    expect(modelName).toBe("weeklyPlan");
    expect(passedParams.allowedFilterFields).toEqual(
      expect.arrayContaining(["weekStartDate", "isArchived"]),
    );
    expect(queryOptions.dateFilterFields).toEqual(
      expect.arrayContaining(["weekStartDate", "createdAt", "updatedAt"]),
    );
    expect(queryOptions.scope).toEqual({
      campusId: "11111111-1111-4111-8111-111111111111",
      isArchived: false,
    });
    expect(mapper).toBe(PrismaWeeklyPlanMapper);
  });
});
