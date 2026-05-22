/**
 * Controller-level tests for AC-5, AC-6, AC-9 (read side) of
 * @doc/specs/admin-audit-log.
 *
 * The 200 happy path + cross-campus-empty path are exercised here via direct
 * instantiation (matches the precedent in `student.controller.spec.ts`).
 *
 * The 401/403 transitions inherit from the shared guard stack
 * (`ClerkAuthGuard`, `PermissionsGuard`) which is covered by guard-level
 * unit tests — they are NOT re-asserted at every controller. Deeper integration
 * coverage of cross-campus isolation (Scenario 5) is owned by @task-9cx0ob.
 */
import { GetAuditEventsByActorUseCase } from "@/application/audit/use-cases/get-audit-events-by-actor.use-case";
import { GetAuditEventsByTargetUseCase } from "@/application/audit/use-cases/get-audit-events-by-target.use-case";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

import { AuditController } from "./audit.controller";

describe("AuditController", () => {
  const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
  const TARGET_ID = "22222222-2222-4222-a222-222222222222";
  const ACTOR_ID = "33333333-3333-4333-a333-333333333333";

  let byTargetUseCase: jest.Mocked<GetAuditEventsByTargetUseCase>;
  let byActorUseCase: jest.Mocked<GetAuditEventsByActorUseCase>;
  let controller: AuditController;

  const happyPage = {
    data: [{ id: "audit-1" } as never],
    pagination: {
      count: 1,
      limit: 10,
      offset: 0,
      totalPages: 1,
      currentPage: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const emptyPage = {
    data: [],
    pagination: {
      count: 0,
      limit: 10,
      offset: 0,
      totalPages: 0,
      currentPage: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  beforeEach(() => {
    byTargetUseCase = {
      execute: jest.fn().mockResolvedValue(happyPage),
    } as unknown as jest.Mocked<GetAuditEventsByTargetUseCase>;
    byActorUseCase = {
      execute: jest.fn().mockResolvedValue(happyPage),
    } as unknown as jest.Mocked<GetAuditEventsByActorUseCase>;
    controller = new AuditController(byTargetUseCase, byActorUseCase);
  });

  describe("GET /audit/by-target (AC-5, AC-9)", () => {
    it("threads @CampusContext + query params + pagination into the use case", async () => {
      const params: StandardRequestDto = { limit: 25, offset: 50 };

      const result = await controller.findByTarget(
        CAMPUS_ID,
        "student",
        TARGET_ID,
        params,
      );

      expect(byTargetUseCase.execute).toHaveBeenCalledWith({
        campusId: CAMPUS_ID,
        targetType: "student",
        targetId: TARGET_ID,
        params,
      });
      expect(result).toBe(happyPage);
    });

    it("returns empty PaginatedResult when the target lives in another campus (system-enforced scope)", async () => {
      byTargetUseCase.execute.mockResolvedValueOnce(emptyPage);

      const result = await controller.findByTarget(
        CAMPUS_ID,
        "student",
        TARGET_ID,
        { limit: 10, offset: 0 },
      );

      expect(result.data).toEqual([]);
      expect(result.pagination.count).toBe(0);
    });
  });

  describe("GET /audit/by-actor (AC-6, AC-9)", () => {
    it("threads @CampusContext + actorId + pagination into the use case", async () => {
      const params: StandardRequestDto = { limit: 5, offset: 10 };

      const result = await controller.findByActor(CAMPUS_ID, ACTOR_ID, params);

      expect(byActorUseCase.execute).toHaveBeenCalledWith({
        campusId: CAMPUS_ID,
        actorId: ACTOR_ID,
        params,
      });
      expect(result).toBe(happyPage);
    });

    it("returns empty PaginatedResult when the actor has no events in this campus (system-enforced scope)", async () => {
      byActorUseCase.execute.mockResolvedValueOnce(emptyPage);

      const result = await controller.findByActor(CAMPUS_ID, ACTOR_ID, {
        limit: 10,
        offset: 0,
      });

      expect(result.data).toEqual([]);
      expect(result.pagination.count).toBe(0);
    });
  });
});
