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
                endDate: null,
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
});
