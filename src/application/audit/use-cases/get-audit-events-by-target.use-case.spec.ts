import { BadRequestException } from "@nestjs/common";

import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

import { GetAuditEventsByTargetUseCase } from "./get-audit-events-by-target.use-case";

describe("GetAuditEventsByTargetUseCase", () => {
  const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
  const TARGET_ID = "22222222-2222-4222-a222-222222222222";

  let repository: jest.Mocked<AuditEventRepository>;
  let useCase: GetAuditEventsByTargetUseCase;

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
      findByTarget: jest.fn().mockResolvedValue(emptyPage),
      findByActor: jest.fn(),
    } as unknown as jest.Mocked<AuditEventRepository>;
    useCase = new GetAuditEventsByTargetUseCase(repository);
  });

  it("forwards arguments to repository.findByTarget with campusId scope", async () => {
    const params: StandardRequest = { limit: 20, offset: 0 };

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      targetType: "student",
      targetId: TARGET_ID,
      params,
    });

    expect(repository.findByTarget).toHaveBeenCalledWith(
      "student",
      TARGET_ID,
      params,
      { campusId: CAMPUS_ID },
    );
    expect(result).toBe(emptyPage);
  });

  it.each(["student", "guardian", "staff"])(
    "accepts targetType=%s",
    async (targetType) => {
      await useCase.execute({
        campusId: CAMPUS_ID,
        targetType,
        targetId: TARGET_ID,
        params: {},
      });
      expect(repository.findByTarget).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects unknown targetType with BadRequestException and does NOT hit the repo", async () => {
    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        targetType: "enrollment",
        targetId: TARGET_ID,
        params: {},
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.findByTarget).not.toHaveBeenCalled();
  });
});
