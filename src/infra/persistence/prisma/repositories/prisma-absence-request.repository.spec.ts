import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  AbsenceRequestStatus,
  AbsenceRequestType,
} from "@/domain/absence-request";

import { PrismaAbsenceRequestMapper } from "../mapper/prisma-absence-request.mapper";
import { PrismaService } from "../prisma.service";
import { PrismaAbsenceRequestRepository } from "./prisma-absence-request.repository";

type AbsenceRequestDelegateMock = {
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

const rowFactory = (overrides: Record<string, unknown> = {}) => ({
  id: "99999999-9999-4999-a999-999999999999",
  campusId: "11111111-1111-4111-a111-111111111111",
  studentId: "22222222-2222-4222-a222-222222222222",
  requesterGuardianId: "33333333-3333-4333-a333-333333333333",
  requesterUserId: "44444444-4444-4444-a444-444444444444",
  absenceType: AbsenceRequestType.PARTIAL_DAY,
  startDate: new Date("2099-07-10T00:00:00.000Z"),
  endDate: new Date("2099-07-10T00:00:00.000Z"),
  startMinute: 540,
  endMinute: 720,
  description: "Medical appointment",
  status: AbsenceRequestStatus.PENDING,
  reviewedById: null,
  reviewedAt: null,
  reviewNote: null,
  createdAt: new Date("2099-07-01T00:00:00.000Z"),
  updatedAt: new Date("2099-07-01T00:00:00.000Z"),
  ...overrides,
});

describe("PrismaAbsenceRequestRepository", () => {
  let repository: PrismaAbsenceRequestRepository;
  let absenceRequestDelegate: AbsenceRequestDelegateMock;
  let queryService: jest.Mocked<PrismaQueryService>;

  beforeEach(() => {
    absenceRequestDelegate = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    queryService = {
      executeQuery: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
    } as unknown as jest.Mocked<PrismaQueryService>;

    repository = new PrismaAbsenceRequestRepository(
      {
        absenceRequest: absenceRequestDelegate,
      } as unknown as PrismaService,
      queryService,
    );
  });

  it("findByIdInCampus always scopes by campus", async () => {
    absenceRequestDelegate.findFirst.mockResolvedValue(rowFactory());

    await repository.findByIdInCampus(
      "11111111-1111-4111-a111-111111111111",
      "99999999-9999-4999-a999-999999999999",
    );

    expect(absenceRequestDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        id: "99999999-9999-4999-a999-999999999999",
        campusId: "11111111-1111-4111-a111-111111111111",
      },
      include: PrismaAbsenceRequestMapper.include,
    });
  });

  it("findByCampusId applies campus, status, and overlapsDate scope through PrismaQueryService", async () => {
    const params = {
      status: AbsenceRequestStatus.PENDING,
      overlapsDate: "2099-07-10",
    };

    await repository.findByCampusId(
      "11111111-1111-4111-a111-111111111111",
      params,
    );

    expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
    const [, modelName, passedParams, options, mapper] =
      queryService.executeQuery.mock.calls[0];
    const queryOptions = options as Record<string, any>;

    expect(modelName).toBe("absenceRequest");
    expect(passedParams.allowedFilterFields).toEqual(
      expect.arrayContaining(["status", "studentId", "startDate", "endDate"]),
    );
    expect(queryOptions.dateFilterFields).toEqual(
      expect.arrayContaining(["startDate", "endDate", "reviewedAt"]),
    );
    expect(queryOptions.scope).toEqual({
      campusId: "11111111-1111-4111-a111-111111111111",
      status: AbsenceRequestStatus.PENDING,
      startDate: { lte: new Date("2099-07-10T00:00:00.000Z") },
      endDate: { gte: new Date("2099-07-10T00:00:00.000Z") },
    });
    expect(mapper).toBe(PrismaAbsenceRequestMapper);
  });

  it("findByRequesterGuardianId scopes to campus and orders newest first", async () => {
    absenceRequestDelegate.findMany.mockResolvedValue([rowFactory()]);

    await repository.findByRequesterGuardianId(
      "11111111-1111-4111-a111-111111111111",
      "33333333-3333-4333-a333-333333333333",
    );

    expect(absenceRequestDelegate.findMany).toHaveBeenCalledWith({
      where: {
        campusId: "11111111-1111-4111-a111-111111111111",
        requesterGuardianId: "33333333-3333-4333-a333-333333333333",
      },
      include: PrismaAbsenceRequestMapper.include,
      orderBy: { createdAt: "desc" },
    });
  });

  it("findActiveOverlaps queries pending/approved date candidates and filters exact time overlaps", async () => {
    absenceRequestDelegate.findMany.mockResolvedValue([
      rowFactory({ startMinute: 540, endMinute: 720 }),
      rowFactory({
        id: "88888888-8888-4888-a888-888888888888",
        startMinute: 720,
        endMinute: 900,
      }),
    ]);

    const result = await repository.findActiveOverlaps(
      "11111111-1111-4111-a111-111111111111",
      "22222222-2222-4222-a222-222222222222",
      {
        absenceType: AbsenceRequestType.PARTIAL_DAY,
        startDate: new Date("2099-07-10T00:00:00.000Z"),
        endDate: new Date("2099-07-10T00:00:00.000Z"),
        startMinute: 600,
        endMinute: 660,
      },
    );

    expect(absenceRequestDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campusId: "11111111-1111-4111-a111-111111111111",
          studentId: "22222222-2222-4222-a222-222222222222",
          status: {
            in: [AbsenceRequestStatus.PENDING, AbsenceRequestStatus.APPROVED],
          },
        }),
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe(
      "99999999-9999-4999-a999-999999999999",
    );
  });
});
