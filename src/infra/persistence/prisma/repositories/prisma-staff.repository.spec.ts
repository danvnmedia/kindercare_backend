import { PrismaStaffRepository } from "./prisma-staff.repository";
import { PrismaService } from "../prisma.service";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PrismaStaffMapper } from "../mapper/prisma-staff.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

// Canonical eager-load shape: queries that need the read-side StaffType
// collection hydrated must include the join with its target StaffType row.
// See @doc/specs/staff-multi-type-refactor#technical-notes.
const EXPECTED_INCLUDE = {
  user: true,
  staffTypes: { include: { staffType: true } },
};

describe("PrismaStaffRepository", () => {
  let repository: PrismaStaffRepository;
  let prisma: Record<string, any>;
  let queryService: jest.Mocked<PrismaQueryService>;

  const emptyResult = { data: [], pagination: {} as any };

  beforeEach(() => {
    prisma = {
      staff: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    queryService = {
      executeQuery: jest.fn().mockResolvedValue(emptyResult),
    } as unknown as jest.Mocked<PrismaQueryService>;

    repository = new PrismaStaffRepository(
      prisma as unknown as PrismaService,
      queryService,
    );
  });

  describe("findAll", () => {
    // findAll delegates to PrismaQueryService.executeQuery, so the tests
    // inspect the args the repo wires into it: pre-extracted filters, the
    // injected relation clause, allowed filter fields, and the eager-load
    // shape. executeQuery's own behavior is exercised by its unit tests.
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

    it("does not advertise staffTypeId or staffTypeIds in allowedFilterFields (relation filter, not flat field)", async () => {
      await repository.findAll({});

      const { params } = callArgs();
      expect(params.allowedFilterFields).not.toContain("staffTypeId");
      expect(params.allowedFilterFields).not.toContain("staffTypeIds");
    });

    it("pre-extracts staffTypeIds: { in: [...] } and injects a relation clause into options.where (FR-6)", async () => {
      const params: StandardRequest = {
        filterInfo: {
          filters: {
            // Standard FilterConditionDto shape — the typed envelope clients
            // produce when serializing { in: [...] }.
            staffTypeIds: { in: ["type-1", "type-2"] } as any,
            fullName: "Alice",
          },
        },
      };

      await repository.findAll(params);

      const { params: passed, options } = callArgs();
      // Relation clause injected via options.where — mirrors
      // findEligibleForClass's `classes: { none: { classId } }` pattern.
      expect(options.where).toEqual({
        staffTypes: { some: { staffTypeId: { in: ["type-1", "type-2"] } } },
      });
      // staffTypeIds removed from the envelope so executeQuery's
      // allowedFilterFields gate does not reject it.
      expect(passed.filterInfo?.filters).not.toHaveProperty("staffTypeIds");
      // Other filters survive untouched.
      expect(passed.filterInfo?.filters).toEqual({ fullName: "Alice" });
    });

    it("pre-extracts when staffTypeIds arrives as a raw array (defensive shape)", async () => {
      const params: StandardRequest = {
        filterInfo: {
          filters: { staffTypeIds: ["type-1"] as any },
        },
      };

      await repository.findAll(params);

      const { options } = callArgs();
      expect(options.where).toEqual({
        staffTypes: { some: { staffTypeId: { in: ["type-1"] } } },
      });
    });

    it("pre-extracts when staffTypeIds arrives as a JSON-encoded filter string", async () => {
      const params: StandardRequest = {
        filter: JSON.stringify({
          staffTypeIds: { in: ["type-1", "type-2"] },
          fullName: "Alice",
        }),
      };

      await repository.findAll(params);

      const { params: passed, options } = callArgs();
      expect(options.where).toEqual({
        staffTypes: { some: { staffTypeId: { in: ["type-1", "type-2"] } } },
      });
      // The JSON-string entry is cleared so executeQuery's own parser does
      // not re-introduce the stripped key on the sanitized envelope.
      expect(passed.filter).toBeUndefined();
      expect(passed.filterInfo?.filters).toEqual({ fullName: "Alice" });
    });

    it("omits the relation clause when no staffTypeIds filter is present", async () => {
      await repository.findAll({
        filterInfo: { filters: { fullName: "Alice" } },
      });

      const { options } = callArgs();
      expect(options.where).toEqual({});
    });

    it("omits the relation clause when staffTypeIds is an empty array (avoids match-nothing surprise)", async () => {
      // An empty IN array would match zero rows in Prisma — silently falling
      // back to no filter is consistent with how buildWhereClause skips
      // unusable filter values elsewhere.
      await repository.findAll({
        filterInfo: { filters: { staffTypeIds: { in: [] } as any } },
      });

      const { options } = callArgs();
      expect(options.where).toEqual({});
    });

    it("eager-loads the nested staff_staff_type → staffType join (read-side hydration)", async () => {
      await repository.findAll({});

      const { options } = callArgs();
      expect(options.include).toEqual(EXPECTED_INCLUDE);
    });

    it("forwards scope so executeQuery applies campus isolation last (cannot be overridden by user)", async () => {
      await repository.findAll({}, { campusId: "campus-1" });

      const { options } = callArgs();
      expect(options.scope).toEqual({ campusId: "campus-1" });
    });

    it("routes through PrismaQueryService.executeQuery against the staff model with PrismaStaffMapper", async () => {
      await repository.findAll({});

      const { prismaArg, modelName, mapper } = callArgs();
      expect(prismaArg).toBe(prisma);
      expect(modelName).toBe("staff");
      expect(mapper).toBe(PrismaStaffMapper);
    });
  });

  describe("findByStaffTypeId", () => {
    it("uses `staffTypes: { some: { staffTypeId } }` relation predicate (multi-type schema)", async () => {
      await repository.findByStaffTypeId("type-1");

      expect(prisma.staff.findMany).toHaveBeenCalledTimes(1);
      const args = prisma.staff.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        staffTypes: { some: { staffTypeId: "type-1" } },
      });
      expect(args.include).toEqual(EXPECTED_INCLUDE);
    });
  });

  describe("findAnyByUserIdInCampus", () => {
    it("uses the campusId/userId compound selector and includes archived rows", async () => {
      await repository.findAnyByUserIdInCampus("user-1", "campus-1");

      expect(prisma.staff.findUnique).toHaveBeenCalledTimes(1);
      expect(prisma.staff.findUnique).toHaveBeenCalledWith({
        where: {
          campusId_userId: {
            campusId: "campus-1",
            userId: "user-1",
          },
        },
        include: EXPECTED_INCLUDE,
      });
    });
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

      const {
        prismaArg,
        modelName,
        mapper,
        params: passedParams,
        options,
      } = callArgs();
      expect(prismaArg).toBe(prisma);
      expect(modelName).toBe("staff");
      expect(mapper).toBe(PrismaStaffMapper);
      // Eager-load follows the canonical nested-join shape so the mapper
      // can project `staff_staff_type → StaffType` into the snapshot array.
      expect(options.include).toEqual(EXPECTED_INCLUDE);
      // Sort surface is the one declared in the plan, in stable order.
      expect(passedParams.allowedSortFields).toEqual([
        "fullName",
        "staffCode",
        "createdAt",
      ]);
    });
  });
});
