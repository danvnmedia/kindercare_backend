import { PrismaStudentRepository } from "./prisma-student.repository";
import { PrismaService } from "../prisma.service";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PrismaStudentMapper } from "../mapper/prisma-student.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

describe("PrismaStudentRepository", () => {
  let repository: PrismaStudentRepository;
  let prisma: Record<string, unknown>;
  let queryService: jest.Mocked<PrismaQueryService>;

  const emptyResult = { data: [], pagination: {} as any };

  beforeEach(() => {
    prisma = {};
    queryService = {
      executeQuery: jest.fn().mockResolvedValue(emptyResult),
    } as unknown as jest.Mocked<PrismaQueryService>;

    repository = new PrismaStudentRepository(
      prisma as unknown as PrismaService,
      queryService,
    );
  });

  describe("findEligibleForClass", () => {
    // Each test calls the repo, then inspects the args we passed to
    // PrismaQueryService.executeQuery. executeQuery itself is exercised by
    // its own unit tests; here we only need to verify the repo wires the
    // correct WHERE, scope, allowed fields, and routing into it.
    const callArgs = () => {
      expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
      const [prismaArg, modelName, params, options, mapper] =
        queryService.executeQuery.mock.calls[0];
      return {
        prismaArg,
        modelName,
        params: params as StandardRequest,
        options: options as Record<string, any>,
        mapper,
      };
    };

    it("excludes active-elsewhere students via NOT EXISTS predicate (AC-13)", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { options } = callArgs();
      // Prisma's `{ none: { endDate: null } }` is the relation-filter form of
      // NOT EXISTS — students with any open enrollment row are excluded.
      expect(options.where).toEqual(
        expect.objectContaining({
          enrollments: { none: { endDate: null } },
        }),
      );
    });

    it("excludes archived students by hard-coding isArchived=false in where", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { options, params: passedParams } = callArgs();
      // isArchived lives in the system `where` (not allowedFilterFields),
      // so callers cannot bypass it by passing a filter.
      expect(options.where).toEqual(
        expect.objectContaining({ isArchived: false }),
      );
      expect(passedParams.allowedFilterFields).not.toContain("isArchived");
    });

    it("respects includeStatuses input by allowing the status filter through", async () => {
      const params: StandardRequest = {
        filter: '{"status":{"in":["ACTIVE","WAITING"]}}',
      };

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { params: passedParams, options } = callArgs();
      // The repo opts `status` into allowedFilterFields so user-supplied
      // include lists (translated by the caller) pass through executeQuery's
      // user-filter sieve. Other arbitrary fields stay rejected.
      expect(passedParams.allowedFilterFields).toEqual(
        expect.arrayContaining(["status"]),
      );
      // status is NOT in system `where` — it's user-controllable.
      expect(options.where).not.toHaveProperty("status");
    });

    it("enforces scope.campusId so cross-campus students are excluded", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { options } = callArgs();
      // Scope is applied LAST inside executeQuery, so a malicious or
      // careless filter cannot override the campus boundary.
      expect(options.scope).toEqual({ campusId: "campus-1" });
    });

    it("routes through PrismaQueryService.executeQuery against the student model with PrismaStudentMapper", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { prismaArg, modelName, mapper, options, params: passedParams } =
        callArgs();
      expect(prismaArg).toBe(prisma);
      expect(modelName).toBe("student");
      expect(mapper).toBe(PrismaStudentMapper);
      // Sort surface is the one declared in the AC, in stable order.
      expect(passedParams.allowedSortFields).toEqual([
        "fullName",
        "studentCode",
        "dateOfBirth",
        "createdAt",
      ]);
      // The guardian include matches the existing findAll shape so the
      // downstream StudentResponse mapping stays consistent.
      expect(options.include).toEqual({
        guardians: {
          include: {
            guardian: true,
            guardianRelationship: true,
          },
        },
      });
    });
  });
});
