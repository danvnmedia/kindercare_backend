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

  describe("findById (current-class projection routing)", () => {
    // findById bypasses PrismaQueryService and queries the view directly,
    // so we stub `prisma.studentWithPhase.findUnique`. This block locks the
    // routing — findById MUST hit the `studentWithPhase` view (the model
    // exposing `currentClassId`+`currentClassName`) and NOT the raw
    // `student` table, otherwise the current-class projection silently
    // drops on every GET /students/:id payload.
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

    it("queries the studentWithPhase view so currentClass projects into the entity (Spec FR-1, FR-2)", async () => {
      const viewRow = {
        ...baseRow,
        phase: "ACTIVE",
        currentClassId: "class-1",
        currentClassName: "Lớp Mầm 1A",
      };
      const findUnique = jest.fn().mockResolvedValue(viewRow);
      prisma.studentWithPhase = { findUnique };

      const student = await repository.findById("student-1");

      expect(findUnique).toHaveBeenCalledTimes(1);
      expect(findUnique).toHaveBeenCalledWith({ where: { id: "student-1" } });
      expect(student?.currentClass).toEqual({
        id: "class-1",
        name: "Lớp Mầm 1A",
      });
    });

    it("returns null when the student is not found (no error, no entity)", async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      prisma.studentWithPhase = { findUnique };

      const student = await repository.findById("missing");

      expect(student).toBeNull();
    });
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

    it("excludes active-elsewhere students via phase != ACTIVE on the view (AC-13)", async () => {
      const params: StandardRequest = {};

      await repository.findEligibleForClass("class-1", params, {
        campusId: "campus-1",
      });

      const { options } = callArgs();
      // The `student_with_phase` view's CASE projects phase='ACTIVE' iff the
      // student has an open Enrollment, so `phase: { not: 'ACTIVE' }` is the
      // view-bound equivalent of the original `enrollments: { none: { endDate: null } }`
      // relation filter. Prisma rejects relation filters on view models, so
      // this is the only form that works once reads target the view (D7).
      expect(options.where).toEqual(
        expect.objectContaining({
          phase: { not: "ACTIVE" },
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

  describe("findAll", () => {
    // Same shape as `findEligibleForClass` above: executeQuery is mocked, so
    // each test inspects the args the repo handed to it. The wire-format
    // operator validation itself lives in PrismaQueryService — its own
    // suite covers that — so here we only verify the repo's contract:
    // allow-list + pass-through behavior.
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

    it("allows `phase` in the user-controllable filter surface", async () => {
      const params: StandardRequest = {};

      await repository.findAll(params);

      const { params: passedParams } = callArgs();
      // Phase is projected onto the studentWithPhase view (Spec D7), so it
      // can be narrowed server-side without a relation filter. The
      // eligible-students surface remains narrower by design (Spec D9).
      expect(passedParams.allowedFilterFields).toContain("phase");
    });

    it("preserves the `phase` filter (in[] form) through to executeQuery", async () => {
      const params: StandardRequest = {
        filter: '{"phase":{"in":["ACTIVE","WAITING"]}}',
      };

      await repository.findAll(params);

      const { params: passedParams } = callArgs();
      // The repo is a pass-through for the JSON filter string — operator
      // validation belongs to PrismaQueryService, not the repository.
      expect(passedParams.filter).toBe(
        '{"phase":{"in":["ACTIVE","WAITING"]}}',
      );
    });

    it("preserves the `phase` filter (eq shorthand) through to executeQuery", async () => {
      const params: StandardRequest = {
        filter: '{"phase":"ACTIVE"}',
      };

      await repository.findAll(params);

      const { params: passedParams } = callArgs();
      expect(passedParams.filter).toBe('{"phase":"ACTIVE"}');
    });

    it("routes through PrismaQueryService.executeQuery against the studentWithPhase view with PrismaStudentMapper", async () => {
      const params: StandardRequest = {};

      await repository.findAll(params);

      const { prismaArg, modelName, mapper } = callArgs();
      expect(prismaArg).toBe(prisma);
      expect(modelName).toBe("studentWithPhase");
      expect(mapper).toBe(PrismaStudentMapper);
    });

    it("makes a single executeQuery call across the full page — no N+1 follow-ups (Spec NFR-1)", async () => {
      // The view eagerly projects currentClassId + currentClassName via
      // its LEFT JOIN LATERAL, so no per-row follow-up is needed to
      // surface the currentClass snapshot on each row of the paginated
      // result. This locks the contract: one query per page, always.
      await repository.findAll({});

      expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
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

  describe("PrismaStudentMapper.toDomain (currentClass projection — Spec AC-1..AC-7, AC-10 mapper seam)", () => {
    // Co-located with the phase projection block above. This block proves
    // the MAPPER SEAM that converts a view row's currentClassId +
    // currentClassName columns into the domain `currentClass` snapshot.
    // The SQL view that PRODUCES those columns (LEFT JOIN LATERAL against
    // the partial-unique-open-enrollment row) is verified manually
    // against a dev DB after migration — this codebase has no
    // testcontainers / test-schema setup that would let us drive real
    // fixtures through real SQL. Same constraint as the phase projection
    // block; same convention.
    //
    // SCOPE — mapper seam coverage here:
    //   - Column extraction + null fallback (raw row vs view row).
    //   - Write-path read-back (raw table → currentClass=null).
    //   - Phase ↔ currentClass invariant projection given the row shape.
    //   - Archive overlay travels alongside (does not suppress) the
    //     snapshot.
    //
    // SCOPE — deferred to manual dev-DB verification:
    //   - The view's LEFT JOIN LATERAL semantics (Spec FR-7) generating
    //     currentClassId + currentClassName from the open Enrollment row.
    //   - The SQL-level phase=ACTIVE ⇔ currentClass non-null invariant
    //     produced by the view (Spec AC-6 at the SQL level — the
    //     mapper-seam contrapositive is asserted below).
    //   - Cross-campus isolation (Spec AC-8) — flows from the
    //     `Class.campusId = Student.campusId` FK that the view's JOIN
    //     respects, not from any mapper code path.
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

    it("projects currentClass={id,name} from a view row with non-null currentClassId (Spec AC-1)", () => {
      const viewRow = {
        ...baseRow,
        phase: "ACTIVE",
        currentClassId: "class-1",
        currentClassName: "Lớp Mầm 1A",
      } as any;

      const student = PrismaStudentMapper.toDomain(viewRow);

      expect(student.currentClass).toEqual({
        id: "class-1",
        name: "Lớp Mầm 1A",
      });
    });

    it("projects currentClass=null from a view row whose currentClassId is null (Spec AC-2)", () => {
      // WITHDRAWN, WAITING, GRADUATED, DEFERRED, or any other
      // no-open-enrollment state: the view's LEFT JOIN LATERAL produces
      // NULL columns and the mapper short-circuits to null. No error,
      // no missing key.
      const viewRow = {
        ...baseRow,
        phase: "WITHDRAWN",
        currentClassId: null,
        currentClassName: null,
      } as any;

      const student = PrismaStudentMapper.toDomain(viewRow);

      expect(student.currentClass).toBeNull();
    });

    it("returns currentClass=null for a raw-table row with no currentClassId column (Spec AC-4 — write read-back)", () => {
      // POST /students and PATCH /students/:id read back from
      // `prisma.student.create` / `prisma.student.update`, which return
      // rows WITHOUT the view's derived columns. The mapper's
      // `"currentClassId" in row` narrowing returns null in that case —
      // parallel to the phase=undefined contract for the same scenario.
      const rawRow = { ...baseRow } as any;

      const student = PrismaStudentMapper.toDomain(rawRow);

      expect(student.currentClass).toBeNull();
    });

    it.each([["WAITING"], ["DEFERRED"], ["GRADUATED"], ["WITHDRAWN"]])(
      "enforces phase=%s ⇒ currentClass=null at the mapper seam (Spec AC-6 — non-ACTIVE branches)",
      (phase) => {
        // The SQL view's LEFT JOIN LATERAL is what makes currentClassId
        // non-null only for ACTIVE rows; here we prove the mapper
        // preserves null for every non-ACTIVE phase, which is the
        // invariant's contrapositive at the projection seam.
        const viewRow = {
          ...baseRow,
          phase,
          currentClassId: null,
          currentClassName: null,
        } as any;

        const student = PrismaStudentMapper.toDomain(viewRow);

        expect(student.phase).toBe(phase);
        expect(student.currentClass).toBeNull();
      },
    );

    it("enforces phase=ACTIVE ⇒ currentClass non-null at the mapper seam (Spec AC-6 — ACTIVE branch)", () => {
      const viewRow = {
        ...baseRow,
        phase: "ACTIVE",
        currentClassId: "class-1",
        currentClassName: "Lớp Mầm 1A",
      } as any;

      const student = PrismaStudentMapper.toDomain(viewRow);

      expect(student.phase).toBe("ACTIVE");
      expect(student.currentClass).toEqual({
        id: "class-1",
        name: "Lớp Mầm 1A",
      });
    });

    it("preserves the archive overlay alongside currentClass for an archived ACTIVE student (Spec AC-7)", () => {
      // Mirrors the AC-23 archive-overlay test in the phase block above:
      // archive is orthogonal to the open-enrollment state, so an
      // archived student with an open Enrollment surfaces all three —
      // isArchived=true AND phase=ACTIVE AND currentClass={id,name}.
      const viewRow = {
        ...baseRow,
        isArchived: true,
        phase: "ACTIVE",
        currentClassId: "class-1",
        currentClassName: "Lớp Mầm 1A",
      } as any;

      const student = PrismaStudentMapper.toDomain(viewRow);

      expect(student.isArchived).toBe(true);
      expect(student.phase).toBe("ACTIVE");
      expect(student.currentClass).toEqual({
        id: "class-1",
        name: "Lớp Mầm 1A",
      });
    });
  });
});
