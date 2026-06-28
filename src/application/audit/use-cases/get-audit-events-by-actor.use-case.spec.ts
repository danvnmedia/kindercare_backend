import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

import { GetAuditEventsByActorUseCase } from "./get-audit-events-by-actor.use-case";

describe("GetAuditEventsByActorUseCase", () => {
  const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
  const ACTOR_ID = "33333333-3333-4333-a333-333333333333";

  let repository: jest.Mocked<AuditEventRepository>;
  let useCase: GetAuditEventsByActorUseCase;

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
    repository = {
      findByTarget: jest.fn(),
      findByActor: jest.fn().mockResolvedValue(emptyPage),
    } as unknown as jest.Mocked<AuditEventRepository>;
    useCase = new GetAuditEventsByActorUseCase(repository);
  });

  it("forwards arguments to repository.findByActor with campusId scope", async () => {
    const params: StandardRequest = { limit: 20, offset: 40 };

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      actorId: ACTOR_ID,
      params,
    });

    expect(repository.findByActor).toHaveBeenCalledWith(ACTOR_ID, params, {
      campusId: CAMPUS_ID,
    });
    expect(result).toBe(emptyPage);
  });

  it("cross-campus reads surface as empty PaginatedResult (scope filters server-side)", async () => {
    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      actorId: ACTOR_ID,
      params: {},
    });

    expect(result.data).toEqual([]);
    expect(result.pagination.count).toBe(0);
    // We did NOT add campusId to params.filter — the scope alone drove the empty result.
    const [, , scope] = repository.findByActor.mock.calls[0]!;
    expect(scope).toEqual({ campusId: CAMPUS_ID });
  });
});
