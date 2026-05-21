/**
 * Cross-campus isolation — integration coverage (AC-13 / Scenario 5 of
 * @doc/specs/admin-audit-log).
 *
 * Wires both read use cases against an in-memory `AuditEventRepository`
 * impl that honours `scope.campusId` (system-enforced) and IGNORES any
 * user-supplied filter — exactly what `PrismaQueryService.executeQuery`
 * promises when called with `allowedFilterFields: []` and `scope: { campusId }`.
 *
 * Asserts:
 *   1. Campus X reads only Campus X rows for a target that ALSO has rows in
 *      Campus Y (sanity).
 *   2. Campus X reads on a target that exists ONLY in Campus Y return empty
 *      (Scenario 5 contract — "cross-campus = empty list, not 404").
 *   3. A `params.filter.campusId = "<other>"` attempt does NOT escape the
 *      scope; the use case passes `input.campusId` to `scope`, never
 *      `params.filter`.
 *   4. Symmetric coverage for by-actor.
 *
 * Notes:
 *   - This suite intentionally co-locates a stripped-down in-memory repo. It
 *     does NOT exercise the real Prisma adapter — that piece is covered by
 *     `prisma-audit-event.repository.spec.ts`, which asserts `executeQuery`
 *     is called with `allowedFilterFields: []` and `scope: { campusId }`.
 *     The integration value here is the use-case → port chain: the use case
 *     correctly threads `input.campusId` to `scope` regardless of params.
 */

import { GetAuditEventsByActorUseCase } from "@/application/audit/use-cases/get-audit-events-by-actor.use-case";
import { GetAuditEventsByTargetUseCase } from "@/application/audit/use-cases/get-audit-events-by-target.use-case";
import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { AuditEvent } from "@/domain/audit";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

const CAMPUS_X = "11111111-1111-4111-a111-111111111111";
const CAMPUS_Y = "22222222-2222-4222-a222-222222222222";

const TARGET_BOB = "33333333-3333-4333-a333-333333333333";
const TARGET_CARLA = "44444444-4444-4444-a444-444444444444";

const ACTOR_ALICE = "55555555-5555-4555-a555-555555555555";
const ACTOR_DAN = "66666666-6666-4666-a666-666666666666";

/**
 * In-memory `AuditEventRepository` that mirrors the Prisma adapter contract:
 * `scope.campusId` is applied AFTER user filters and ALWAYS wins. The user
 * `params` object is ignored except for pagination (limit/offset) and sort
 * (DESC by createdAt is the fixed order — `allowedSortFields: []`).
 *
 * The mock implementation deliberately ignores `params.filter` entirely so a
 * spec that tries to inject `filter.campusId` cannot bypass the scope. This
 * mirrors `executeQuery({ allowedFilterFields: [] })`.
 */
class InMemoryAuditRepo extends AuditEventRepository {
  constructor(private readonly rows: AuditEvent[]) {
    super();
  }

  async findByTarget(
    targetType: AuditEvent["targetType"],
    targetId: string,
    params: StandardRequest,
    scope: { campusId: string },
  ) {
    return paginate(
      this.rows
        .filter(
          (r) =>
            r.targetType === targetType &&
            r.targetId === targetId &&
            r.campusId === scope.campusId,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      params,
    );
  }

  async findByActor(
    actorId: string,
    params: StandardRequest,
    scope: { campusId: string },
  ) {
    return paginate(
      this.rows
        .filter((r) => r.actorId === actorId && r.campusId === scope.campusId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      params,
    );
  }
}

function paginate(rows: AuditEvent[], params: StandardRequest) {
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const data = rows.slice(offset, offset + limit);
  return {
    data,
    pagination: {
      count: rows.length,
      limit,
      offset,
      totalPages: limit > 0 ? Math.ceil(rows.length / limit) : 0,
      currentPage: limit > 0 ? Math.floor(offset / limit) + 1 : 1,
      hasNext: offset + limit < rows.length,
      hasPrev: offset > 0,
    },
  };
}

function makeRow(opts: {
  id: string;
  campusId: string;
  actorId: string;
  targetId: string;
  action?: AuditEvent["action"];
  createdAt: Date;
}): AuditEvent {
  return AuditEvent.reconstitute(
    {
      actorId: opts.actorId,
      action: opts.action ?? "EDIT_STUDENT_PROFILE",
      targetType: "student",
      targetId: opts.targetId,
      campusId: opts.campusId,
      beforeValue: null,
      afterValue: null,
      context: { actorName: "Snapshot" },
      visibility: "ADMIN",
      createdAt: opts.createdAt,
    },
    opts.id,
  );
}

describe("Cross-campus isolation (admin-audit-log AC-13 / Scenario 5)", () => {
  let repo: InMemoryAuditRepo;
  let byTarget: GetAuditEventsByTargetUseCase;
  let byActor: GetAuditEventsByActorUseCase;

  beforeEach(() => {
    repo = new InMemoryAuditRepo([
      // Bob has rows in both campuses (same UUID across campuses — implausible
      // in production but the contract MUST still segregate).
      makeRow({
        id: "x-bob-1",
        campusId: CAMPUS_X,
        actorId: ACTOR_ALICE,
        targetId: TARGET_BOB,
        createdAt: new Date("2026-01-10T10:00:00Z"),
      }),
      makeRow({
        id: "x-bob-2",
        campusId: CAMPUS_X,
        actorId: ACTOR_ALICE,
        targetId: TARGET_BOB,
        createdAt: new Date("2026-02-20T10:00:00Z"),
      }),
      makeRow({
        id: "y-bob-1",
        campusId: CAMPUS_Y,
        actorId: ACTOR_DAN,
        targetId: TARGET_BOB,
        createdAt: new Date("2026-03-30T10:00:00Z"),
      }),

      // Carla exists only in Campus Y.
      makeRow({
        id: "y-carla-1",
        campusId: CAMPUS_Y,
        actorId: ACTOR_DAN,
        targetId: TARGET_CARLA,
        createdAt: new Date("2026-04-01T10:00:00Z"),
      }),
    ]);
    byTarget = new GetAuditEventsByTargetUseCase(repo);
    byActor = new GetAuditEventsByActorUseCase(repo);
  });

  describe("by-target", () => {
    it("Campus X reads only Campus X rows for a target that has rows in both campuses", async () => {
      const result = await byTarget.execute({
        campusId: CAMPUS_X,
        targetType: "student",
        targetId: TARGET_BOB,
        params: { limit: 20, offset: 0 },
      });

      expect(result.data).toHaveLength(2);
      expect(result.data.map((r) => r.id.toString())).toEqual([
        "x-bob-2",
        "x-bob-1",
      ]);
      expect(result.data.every((r) => r.campusId === CAMPUS_X)).toBe(true);
    });

    it("Campus X reads on a Campus-Y-only target return EMPTY (Scenario 5)", async () => {
      const result = await byTarget.execute({
        campusId: CAMPUS_X,
        targetType: "student",
        targetId: TARGET_CARLA,
        params: { limit: 20, offset: 0 },
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.count).toBe(0);
    });

    it("a filter param trying to inject campusId does NOT escape scope", async () => {
      // The spec promises `allowedFilterFields: []` at the repo level — the
      // user cannot ask for `?filter={"campusId":"<other>"}` and see rows
      // from the other campus. Here we go one level higher and prove the
      // use case never copies anything from `params.filter` into scope.
      const sneakyParams: StandardRequest = {
        limit: 20,
        offset: 0,
        // @ts-expect-error — intentionally injecting an unsupported filter
        filter: { campusId: CAMPUS_Y, targetId: TARGET_BOB },
      };

      const result = await byTarget.execute({
        campusId: CAMPUS_X,
        targetType: "student",
        targetId: TARGET_BOB,
        params: sneakyParams,
      });

      // Same as the first test — only Campus X rows surface, regardless of
      // what the caller tried to put in `params.filter`.
      expect(result.data).toHaveLength(2);
      expect(result.data.every((r) => r.campusId === CAMPUS_X)).toBe(true);
    });
  });

  describe("by-actor (symmetric)", () => {
    it("Campus X reads only Campus X rows for an actor active in both campuses", async () => {
      // Alice is the actor in Campus X; even if she had cross-campus activity
      // in production, the read endpoint MUST only surface the rows tagged to
      // the caller's campus context.
      const xResult = await byActor.execute({
        campusId: CAMPUS_X,
        actorId: ACTOR_ALICE,
        params: { limit: 20, offset: 0 },
      });

      expect(xResult.data).toHaveLength(2);
      expect(xResult.data.every((r) => r.campusId === CAMPUS_X)).toBe(true);
      expect(xResult.data.every((r) => r.actorId === ACTOR_ALICE)).toBe(true);
    });

    it("Campus X reads on a Campus-Y-only actor return EMPTY", async () => {
      const result = await byActor.execute({
        campusId: CAMPUS_X,
        actorId: ACTOR_DAN,
        params: { limit: 20, offset: 0 },
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.count).toBe(0);
    });
  });
});
