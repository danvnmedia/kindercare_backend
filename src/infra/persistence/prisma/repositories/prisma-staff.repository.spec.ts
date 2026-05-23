import { PrismaStaffRepository } from "./prisma-staff.repository";
import { PrismaService } from "../prisma.service";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PrismaStaffMapper } from "../mapper/prisma-staff.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

describe("PrismaStaffRepository", () => {
  let repository: PrismaStaffRepository;
  let prisma: Record<string, unknown>;
  let queryService: jest.Mocked<PrismaQueryService>;

  const emptyResult = { data: [], pagination: {} as any };

  beforeEach(() => {
    prisma = {};
    queryService = {
      executeQuery: jest.fn().mockResolvedValue(emptyResult),
    } as unknown as jest.Mocked<PrismaQueryService>;

    repository = new PrismaStaffRepository(
      prisma as unknown as PrismaService,
      queryService,
    );
  });

  describe("findEligibleForClass", () => {
    // Each test calls the repo, then inspects the args we passed to
    // PrismaQueryService.executeQuery. executeQuery itself is exercised by
    // its own unit tests; here we only verify the repo wires the correct
    // WHERE, scope, allowed fields, and routing into it.
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

    it("excludes already-assigned staff via classes: { none: { classId } } anti-join (AC-10, AC-13)", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { options } = callArgs();
      // Prisma's `{ none }` relation predicate compiles to a NOT EXISTS
      // subquery against classStaff, which is the typed equivalent of the
      // raw NOT EXISTS form permitted by @doc/specs/bulk-class-staff-assignment D4.
      // Excludes any classStaff row regardless of role (AC-13).
      expect(options.where).toEqual(
        expect.objectContaining({
          classes: { none: { classId: "class-1" } },
        }),
      );
    });

    it("excludes archived staff by hard-coding isArchived=false in where", async () => {
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

    it("enforces scope.campusId so cross-campus staff are excluded", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { options } = callArgs();
      // Scope is applied LAST inside executeQuery, so a malicious or
      // careless filter cannot override the campus boundary.
      expect(options.scope).toEqual({ campusId: "campus-1" });
    });

    it("does NOT allow staffCode/email/phone/etc. in the user-controllable filter surface", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { params: passedParams } = callArgs();
      // Only fullName is exposed for ?search ilike — everything else stays
      // out of the user-controllable filter surface.
      expect(passedParams.allowedFilterFields).toEqual(["fullName"]);
    });

    it("routes through PrismaQueryService.executeQuery against the staff model with PrismaStaffMapper (AC-15)", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { prismaArg, modelName, mapper, params: passedParams, options } =
        callArgs();
      expect(prismaArg).toBe(prisma);
      expect(modelName).toBe("staff");
      expect(mapper).toBe(PrismaStaffMapper);
      expect(options.include).toEqual({ user: true, staffType: true });
      // Sort surface is the one declared in the plan, in stable order.
      expect(passedParams.allowedSortFields).toEqual([
        "fullName",
        "staffCode",
        "createdAt",
        "startDate",
      ]);
    });
  });
});
