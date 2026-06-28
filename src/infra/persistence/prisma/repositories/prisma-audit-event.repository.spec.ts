import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

import { PrismaAuditEventMapper } from "../mapper/prisma-audit-event.mapper";
import { PrismaService } from "../prisma.service";

import { PrismaAuditEventRepository } from "./prisma-audit-event.repository";

describe("PrismaAuditEventRepository", () => {
  let prisma: jest.Mocked<PrismaService>;
  let queryService: jest.Mocked<PrismaQueryService>;
  let repo: PrismaAuditEventRepository;

  const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
  const TARGET_ID = "22222222-2222-4222-a222-222222222222";
  const ACTOR_ID = "33333333-3333-4333-a333-333333333333";

  const params: StandardRequest = { limit: 25, offset: 50 };
  const emptyResult = {
    data: [],
    pagination: {
      count: 0,
      limit: 25,
      offset: 50,
      totalPages: 0,
      currentPage: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  beforeEach(() => {
    prisma = {} as unknown as jest.Mocked<PrismaService>;
    queryService = {
      executeQuery: jest.fn().mockResolvedValue(emptyResult),
    } as unknown as jest.Mocked<PrismaQueryService>;
    repo = new PrismaAuditEventRepository(prisma, queryService);
  });

  describe("findByTarget", () => {
    it("calls executeQuery with targetType/targetId in where, DESC by createdAt, scope=campusId", async () => {
      const result = await repo.findByTarget("student", TARGET_ID, params, {
        campusId: CAMPUS_ID,
      });

      expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
      const [prismaArg, modelName, paramsArg, options, mapper] =
        queryService.executeQuery.mock.calls[0]!;
      expect(prismaArg).toBe(prisma);
      expect(modelName).toBe("auditEvent");
      expect(paramsArg).toBe(params);
      expect(options).toEqual({
        where: { targetType: "student", targetId: TARGET_ID },
        orderBy: { createdAt: "desc" },
        scope: { campusId: CAMPUS_ID },
        allowedFilterFields: [],
        allowedSortFields: [],
      });
      expect(mapper).toBe(PrismaAuditEventMapper);
      expect(result).toBe(emptyResult);
    });

    it("threads pagination params through unchanged (limit/offset)", async () => {
      const paged: StandardRequest = { limit: 5, offset: 10 };

      await repo.findByTarget("guardian", TARGET_ID, paged, {
        campusId: CAMPUS_ID,
      });

      expect(queryService.executeQuery.mock.calls[0]![2]).toBe(paged);
    });
  });

  describe("findByActor", () => {
    it("calls executeQuery with actorId in where, DESC by createdAt, scope=campusId", async () => {
      await repo.findByActor(ACTOR_ID, params, { campusId: CAMPUS_ID });

      expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
      const options = queryService.executeQuery.mock.calls[0]![3]!;
      expect(options).toEqual({
        where: { actorId: ACTOR_ID },
        orderBy: { createdAt: "desc" },
        scope: { campusId: CAMPUS_ID },
        allowedFilterFields: [],
        allowedSortFields: [],
      });
    });

    it("does NOT add campusId to allowedFilterFields (system-enforced only)", async () => {
      await repo.findByActor(ACTOR_ID, params, { campusId: CAMPUS_ID });

      const options = queryService.executeQuery.mock.calls[0]![3]!;
      expect(options.allowedFilterFields).toEqual([]);
    });
  });
});
