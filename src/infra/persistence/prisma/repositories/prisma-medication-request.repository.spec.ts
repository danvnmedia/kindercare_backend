import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { MedicationRequestStatus } from "@/domain/medication";

import { PrismaService } from "../prisma.service";
import { PrismaMedicationRequestRepository } from "./prisma-medication-request.repository";

const medicationUserSummaryInclude = {
  include: {
    staffs: {
      select: { campusId: true, fullName: true, email: true },
    },
    guardians: {
      select: { campusId: true, fullName: true, email: true },
    },
  },
};

const medicationOccurrenceDetailInclude = expect.objectContaining({
  include: {
    logs: {
      include: {
        recordedBy: medicationUserSummaryInclude,
      },
      orderBy: [{ recordedAt: "asc" }, { createdAt: "asc" }],
    },
  },
  orderBy: [{ dueDate: "asc" }, { dueMinute: "asc" }],
});

describe("PrismaMedicationRequestRepository", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-11T23:59:59.999Z"));
  });

  afterEach(() => jest.useRealTimers());

  it("builds staff list scope for campus, direct filters, class, date overlap, and search", async () => {
    const prisma = {} as unknown as PrismaService;
    const queryService = {
      executeQuery: jest.fn().mockResolvedValue({
        data: [],
        pagination: {
          count: 0,
          limit: 20,
          offset: 0,
          totalPages: 0,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    } as unknown as jest.Mocked<PrismaQueryService>;
    const repository = new PrismaMedicationRequestRepository(
      prisma,
      queryService,
    );

    await repository.findByCampusId("11111111-1111-4111-a111-111111111111", {
      status: MedicationRequestStatus.SUBMITTED,
      studentId: "22222222-2222-4222-a222-222222222222",
      classId: "33333333-3333-4333-a333-333333333333",
      enrollmentReferenceDate: new Date("2026-07-11T00:00:00.000Z"),
      fromDate: "2099-07-01",
      toDate: "2099-07-31",
      search: " Antibiotic ",
    });

    expect(queryService.executeQuery).toHaveBeenCalledWith(
      prisma,
      "medicationRequest",
      expect.objectContaining({
        allowedFilterFields: [
          "status",
          "studentId",
          "createdAt",
          "updatedAt",
          "startDate",
          "endDate",
        ],
        allowedSortFields: ["createdAt", "updatedAt", "startDate"],
      }),
      expect.objectContaining({
        scope: expect.objectContaining({
          campusId: "11111111-1111-4111-a111-111111111111",
          status: MedicationRequestStatus.SUBMITTED,
          studentId: "22222222-2222-4222-a222-222222222222",
          student: {
            enrollments: {
              some: {
                classId: "33333333-3333-4333-a333-333333333333",
                cancelledAt: null,
                enrollmentDate: {
                  lte: new Date("2026-07-11T00:00:00.000Z"),
                },
                OR: [
                  { endDate: null },
                  {
                    endDate: { gte: new Date("2026-07-11T00:00:00.000Z") },
                  },
                ],
              },
            },
          },
          endDate: { gte: new Date("2099-07-01T00:00:00.000Z") },
          startDate: { lte: new Date("2099-07-31T00:00:00.000Z") },
          OR: expect.arrayContaining([
            { reason: { contains: "Antibiotic", mode: "insensitive" } },
            {
              items: {
                some: {
                  medicationName: {
                    contains: "Antibiotic",
                    mode: "insensitive",
                  },
                },
              },
            },
          ]),
        }),
      }),
      expect.any(Function),
    );
  });

  it("loads staff detail with occurrences and append-only logs", async () => {
    const medicationRequestDelegate = {
      findFirst: jest.fn().mockResolvedValue(null),
    };
    const repository = new PrismaMedicationRequestRepository(
      {
        medicationRequest: medicationRequestDelegate,
      } as unknown as PrismaService,
      {} as PrismaQueryService,
    );

    await repository.findDetailByIdInCampus(
      "11111111-1111-4111-a111-111111111111",
      "22222222-2222-4222-a222-222222222222",
    );

    expect(medicationRequestDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "22222222-2222-4222-a222-222222222222",
          campusId: "11111111-1111-4111-a111-111111111111",
        },
        include: expect.objectContaining({
          reviewedByUser: medicationUserSummaryInclude,
          occurrences: medicationOccurrenceDetailInclude,
        }),
      }),
    );
  });

  it("counts Health Center request summary statuses by campus", async () => {
    const medicationRequestDelegate = {
      count: jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1),
    };
    const repository = new PrismaMedicationRequestRepository(
      {
        medicationRequest: medicationRequestDelegate,
      } as unknown as PrismaService,
      {} as PrismaQueryService,
    );

    const result = await repository.countHealthCenterSummaryByCampus(
      "11111111-1111-4111-a111-111111111111",
    );

    expect(medicationRequestDelegate.count).toHaveBeenNthCalledWith(1, {
      where: {
        campusId: "11111111-1111-4111-a111-111111111111",
        status: MedicationRequestStatus.SUBMITTED,
      },
    });
    expect(medicationRequestDelegate.count).toHaveBeenNthCalledWith(2, {
      where: {
        campusId: "11111111-1111-4111-a111-111111111111",
        status: MedicationRequestStatus.NEEDS_MORE_INFO,
      },
    });
    expect(result).toEqual({ pendingRequests: 3, needsMoreInfo: 1 });
  });

  it("counts only unexpired submitted requests while using the selected date only for class enrollment", async () => {
    const medicationRequestDelegate = {
      count: jest.fn().mockResolvedValue(4),
    };
    const repository = new PrismaMedicationRequestRepository(
      {
        medicationRequest: medicationRequestDelegate,
      } as unknown as PrismaService,
      {} as PrismaQueryService,
    );
    const actualDate = new Date("2026-07-01T00:00:00.000Z");
    const enrollmentReferenceDate = new Date("2026-06-15T00:00:00.000Z");

    await expect(
      repository.countHealthCenterRequestsNeedingReview(
        "11111111-1111-4111-a111-111111111111",
        {
          actualDate,
          enrollmentReferenceDate,
          classId: "33333333-3333-4333-a333-333333333333",
        },
      ),
    ).resolves.toBe(4);

    const where = medicationRequestDelegate.count.mock.calls[0][0].where;
    expect(where).toEqual({
      campusId: "11111111-1111-4111-a111-111111111111",
      status: MedicationRequestStatus.SUBMITTED,
      endDate: { gte: actualDate },
      student: {
        campusId: "11111111-1111-4111-a111-111111111111",
        enrollments: {
          some: {
            classId: "33333333-3333-4333-a333-333333333333",
            class: {
              campusId: "11111111-1111-4111-a111-111111111111",
            },
            cancelledAt: null,
            enrollmentDate: { lte: enrollmentReferenceDate },
            OR: [
              { endDate: null },
              { endDate: { gte: enrollmentReferenceDate } },
            ],
          },
        },
      },
    });
    expect(where.startDate).toBeUndefined();
  });

  it("builds student medication history scope with campus, student, status, date overlap, and pagination", async () => {
    const medicationRequestDelegate = {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    const repository = new PrismaMedicationRequestRepository(
      {
        medicationRequest: medicationRequestDelegate,
      } as unknown as PrismaService,
      {} as PrismaQueryService,
    );

    const result = await repository.findByStudentInCampus(
      "11111111-1111-4111-a111-111111111111",
      "22222222-2222-4222-a222-222222222222",
      {
        status: MedicationRequestStatus.APPROVED,
        fromDate: "2099-07-01",
        toDate: "2099-07-31",
        limit: 25,
        offset: 50,
      },
    );

    expect(medicationRequestDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campusId: "11111111-1111-4111-a111-111111111111",
          studentId: "22222222-2222-4222-a222-222222222222",
          status: MedicationRequestStatus.APPROVED,
          endDate: { gte: new Date("2099-07-01T00:00:00.000Z") },
          startDate: { lte: new Date("2099-07-31T00:00:00.000Z") },
        },
        skip: 50,
        take: 25,
        include: expect.objectContaining({
          reviewedByUser: medicationUserSummaryInclude,
          occurrences: medicationOccurrenceDetailInclude,
        }),
      }),
    );
    expect(medicationRequestDelegate.count).toHaveBeenCalledWith({
      where: {
        campusId: "11111111-1111-4111-a111-111111111111",
        studentId: "22222222-2222-4222-a222-222222222222",
        status: MedicationRequestStatus.APPROVED,
        endDate: { gte: new Date("2099-07-01T00:00:00.000Z") },
        startDate: { lte: new Date("2099-07-31T00:00:00.000Z") },
      },
    });
    expect(result.pagination).toMatchObject({
      count: 0,
      limit: 25,
      offset: 50,
      totalPages: 0,
    });
  });

  it("selects only eligible lifecycle candidates in stable rotating ID order", async () => {
    const cursor = "55555555-5555-4555-a555-555555555555";
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: "66666666-6666-4666-a666-666666666666",
          timeZone: "America/Toronto",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "11111111-1111-4111-a111-111111111111",
          timeZone: "Asia/Ho_Chi_Minh",
        },
      ]);
    const repository = new PrismaMedicationRequestRepository(
      {
        $queryRaw: queryRaw,
        medicationRequest: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService,
      {} as PrismaQueryService,
    );
    const now = new Date("2026-07-03T12:00:00.000Z");

    await repository.findLifecycleCandidates({
      now,
      limit: 2,
      afterId: cursor,
    });

    expect(queryRaw).toHaveBeenCalledTimes(2);
    const firstQuery = queryRaw.mock.calls[0][0] as {
      strings: string[];
      values: unknown[];
    };
    const sql = firstQuery.strings.join("?");
    expect(sql).toContain("mr.status IN ('SUBMITTED', 'NEEDS_MORE_INFO')");
    expect(sql).toContain("mr.status = 'APPROVED'");
    expect(sql).toContain("clock.local_now::date > mr.end_date");
    expect(sql).toContain("ORDER BY mr.id ASC");
    expect(firstQuery.values).toEqual(expect.arrayContaining([now, cursor, 2]));
    const wrappedQuery = queryRaw.mock.calls[1][0] as {
      strings: string[];
      values: unknown[];
    };
    expect(wrappedQuery.strings.join("?")).toContain("mr.id <=");
    expect(wrappedQuery.values).toEqual(
      expect.arrayContaining([now, cursor, 1]),
    );
  });

  it("hydrates lifecycle candidates with campus timezone and occurrences", async () => {
    const id = "55555555-5555-4555-a555-555555555555";
    const now = new Date("2026-07-03T12:00:00.000Z");
    const medicationRequest = {
      findMany: jest.fn().mockResolvedValue([
        {
          id,
          campusId: "11111111-1111-4111-a111-111111111111",
          studentId: "22222222-2222-4222-a222-222222222222",
          requesterGuardianId: "33333333-3333-4333-a333-333333333333",
          requesterUserId: null,
          status: MedicationRequestStatus.APPROVED,
          startDate: new Date("2026-07-01T00:00:00.000Z"),
          endDate: new Date("2026-07-02T00:00:00.000Z"),
          reason: null,
          parentNotes: null,
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNote: null,
          cancelledAt: null,
          cancelReason: null,
          completedAt: null,
          expiredAt: null,
          createdAt: now,
          updatedAt: now,
          items: [
            {
              id: "44444444-4444-4444-a444-444444444444",
              requestId: id,
              medicationName: "Medicine",
              dosage: null,
              instructions: "Give with water.",
              timesOfDay: ["10:00"],
              scheduleNotes: null,
              notes: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
          occurrences: [
            {
              id: "77777777-7777-4777-a777-777777777777",
              requestId: id,
              medicationItemId: "44444444-4444-4444-a444-444444444444",
              campusId: "11111111-1111-4111-a111-111111111111",
              studentId: "22222222-2222-4222-a222-222222222222",
              dueDate: new Date("2026-07-02T00:00:00.000Z"),
              dueMinute: 600,
              latestOutcome: null,
              latestLogId: null,
              latestRecordedAt: null,
              latestRecordedByUserId: null,
              latestNote: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ]),
    };
    const repository = new PrismaMedicationRequestRepository(
      {
        $queryRaw: jest
          .fn()
          .mockResolvedValue([{ id, timeZone: "America/Toronto" }]),
        medicationRequest,
      } as unknown as PrismaService,
      {} as PrismaQueryService,
    );

    const candidates = await repository.findLifecycleCandidates({
      now,
      limit: 1,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].timeZone).toBe("America/Toronto");
    expect(candidates[0].request.occurrences).toHaveLength(1);
    expect(medicationRequest.findMany).toHaveBeenCalledWith({
      where: { id: { in: [id] } },
      include: expect.objectContaining({
        items: expect.any(Object),
        occurrences: expect.any(Object),
      }),
    });
  });

  it.each([
    [
      MedicationRequestStatus.COMPLETED,
      MedicationRequestStatus.APPROVED,
      "completedAt",
    ],
    [
      MedicationRequestStatus.EXPIRED,
      MedicationRequestStatus.SUBMITTED,
      "expiredAt",
    ],
  ] as const)(
    "conditionally transitions to %s with campus/source status scope",
    async (targetStatus, sourceStatus, timestampField) => {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const repository = new PrismaMedicationRequestRepository(
        {
          medicationRequest: { updateMany },
        } as unknown as PrismaService,
        {} as PrismaQueryService,
      );
      const effectiveAt = new Date("2026-07-03T10:00:00.000Z");
      const updatedAt = new Date("2026-07-03T10:05:00.000Z");

      await expect(
        repository.transitionToTerminalIfStatusIn({
          requestId: "55555555-5555-4555-a555-555555555555",
          campusId: "11111111-1111-4111-a111-111111111111",
          sourceStatuses: [sourceStatus],
          targetStatus,
          effectiveAt,
          updatedAt,
        }),
      ).resolves.toBe(true);
      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: "55555555-5555-4555-a555-555555555555",
          campusId: "11111111-1111-4111-a111-111111111111",
          status: { in: [sourceStatus] },
        },
        data: {
          status: targetStatus,
          [timestampField]: effectiveAt,
          [timestampField === "completedAt" ? "expiredAt" : "completedAt"]:
            null,
          updatedAt,
        },
      });
    },
  );
});
