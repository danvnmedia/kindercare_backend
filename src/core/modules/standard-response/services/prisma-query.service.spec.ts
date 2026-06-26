import { StandardRequest } from "../dto/standard-request.dto";
import { PrismaQueryService } from "./prisma-query.service";

describe("PrismaQueryService", () => {
  let service: PrismaQueryService;

  beforeEach(() => {
    service = new PrismaQueryService();
  });

  it("coerces configured direct date filters before querying Prisma", async () => {
    const params = {
      filterInfo: {
        filters: {
          weekStartDate: "2026-06-22",
        },
      },
      limit: 10,
      offset: 0,
    } as StandardRequest;
    const delegate = {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const prismaClient = { weeklyPlan: delegate };

    await service.executeQuery(prismaClient, "weeklyPlan", params, {
      allowedFilterFields: ["weekStartDate"],
      dateFilterFields: ["weekStartDate"],
      scope: { campusId: "11111111-1111-4111-8111-111111111111" },
    });

    const expectedWhere = {
      weekStartDate: new Date("2026-06-22T00:00:00.000Z"),
      campusId: "11111111-1111-4111-8111-111111111111",
    };

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(delegate.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("coerces configured date range filters before querying Prisma", async () => {
    const params = {
      filterInfo: {
        filters: {
          weekStartDate: {
            between: ["2026-06-22", "2026-06-28"],
          },
        },
      },
      limit: 10,
      offset: 0,
    } as StandardRequest;
    const delegate = {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const prismaClient = { mealMenu: delegate };

    await service.executeQuery(prismaClient, "mealMenu", params, {
      allowedFilterFields: ["weekStartDate"],
      dateFilterFields: ["weekStartDate"],
    });

    const expectedWhere = {
      weekStartDate: {
        gte: new Date("2026-06-22T00:00:00.000Z"),
        lte: new Date("2026-06-28T00:00:00.000Z"),
      },
    };

    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(delegate.count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
