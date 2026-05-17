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

    it("does NOT allow status in the user-controllable filter surface (D9 cutover)", async () => {
      const params: StandardRequest = {
        filter: '{"status":{"in":["ACTIVE","WAITING"]}}',
      };

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { params: passedParams, options } = callArgs();
      // After D9 the status filter surface is gone — callers cannot pass it
      // through `?filter`, and the system `where` does not enforce a status
      // predicate. Phase narrowing is a client-side concern.
      expect(passedParams.allowedFilterFields).not.toContain("status");
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

    it("routes through PrismaQueryService.executeQuery against the studentWithPhase view with PrismaStudentMapper (AC-14)", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { prismaArg, modelName, mapper, params: passedParams } = callArgs();
      expect(prismaArg).toBe(prisma);
      // Reads target the `student_with_phase` view so `phase` is projected
      // into the entity at mapping time (Spec D7 / AC-14).
      expect(modelName).toBe("studentWithPhase");
      expect(mapper).toBe(PrismaStudentMapper);
      // Sort surface is the one declared in the AC, in stable order.
      expect(passedParams.allowedSortFields).toEqual([
        "fullName",
        "studentCode",
        "dateOfBirth",
        "createdAt",
      ]);
      expect(passedParams.allowedFilterFields).toEqual([
        "fullName",
        "studentCode",
      ]);
    });
  });

  describe("PrismaStudentMapper.toDomain (phase projection — AC-14, AC-15, AC-18..AC-23)", () => {
    // Co-located with the repository spec because the mapper is the seam
    // that converts view rows -> domain entity, and AC-14/AC-15/AC-18..AC-23
    // all sit on exactly that boundary. Pure unit test — no Prisma client.
    //
    // SCOPE NOTE: these tests prove the PROJECTION SEAM — given a view row
    // carrying phase=X, the mapper surfaces phase=X on the domain entity.
    // The SQL CASE expression in the `student_with_phase` view that PRODUCES
    // each phase value (e.g. "no Enrollment + no SYE => WAITING") is
    // verified manually against a dev DB after migration; this codebase
    // has no testcontainers/test-schema setup that would let us drive
    // real fixtures through real SQL. See
    // @doc/specs/student-status-simplification#technical-notes for the
    // view definition that backs each branch.
    const baseRow = {
      id: "student-1",
      campusId: "campus-1",
      studentCode: "STU-001",
      fullName: "Test Student",
      email: null,
      phoneNumber: null,
      address: null,
      dateOfBirth: null,
      nickname: null,
      gender: null,
      isArchived: false,
      createdAt: new Date("2026-05-16T00:00:00.000Z"),
      updatedAt: new Date("2026-05-16T00:00:00.000Z"),
    };

    it("projects phase from a view-typed row (AC-14)", () => {
      const viewRow = { ...baseRow, phase: "ACTIVE" } as any;

      const student = PrismaStudentMapper.toDomain(viewRow);

      expect(student.phase).toBe("ACTIVE");
    });

    it("returns phase=undefined when reading from a raw-table row (AC-15)", () => {
      // post-save / post-update reads come back from `prisma.student.create`
      // / `prisma.student.update`, which return raw rows without `phase`.
      // The mapper must surface this as `undefined`, not crash and not
      // fabricate a value.
      const rawRow = { ...baseRow } as any;

      const student = PrismaStudentMapper.toDomain(rawRow);

      expect(student.phase).toBeUndefined();
    });

    // AC-18..AC-22: each phase from the D6 taxonomy survives projection.
    // The label in each row maps to the scenario the SQL CASE branch covers,
    // so a future reader can trace back from "WAITING" -> "newly registered".
    it.each([
      ["WAITING", "AC-18: newly registered student (no Enrollment, no SYE)"],
      ["ACTIVE", "AC-19: student with open Enrollment"],
      ["GRADUATED", "AC-20: closed SYE exitReason=GRADUATED"],
      ["WITHDRAWN", "AC-21: closed SYE exitReason=WITHDRAWN"],
      ["DEFERRED", "AC-22: open SYE in a future school year"],
    ])("projects phase=%s onto the entity (%s)", (phase) => {
      const viewRow = { ...baseRow, phase } as any;

      const student = PrismaStudentMapper.toDomain(viewRow);

      expect(student.phase).toBe(phase);
    });

    it("surfaces isArchived=true alongside underlying phase (AC-23 archive overlay)", () => {
      // Archive is orthogonal (Spec D6): a student with an open Enrollment
      // and isArchived=true still derives phase=ACTIVE. The overlay does
      // not replace the underlying phase — it travels alongside it.
      const viewRow = {
        ...baseRow,
        isArchived: true,
        phase: "ACTIVE",
      } as any;

      const student = PrismaStudentMapper.toDomain(viewRow);

      expect(student.isArchived).toBe(true);
      expect(student.phase).toBe("ACTIVE");
    });
  });
});
