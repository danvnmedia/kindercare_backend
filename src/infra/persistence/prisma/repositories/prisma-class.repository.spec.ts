import { PrismaClassRepository } from "./prisma-class.repository";
import { PrismaService } from "../prisma.service";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

type EnrollmentDelegateMock = {
  groupBy: jest.Mock;
};

describe("PrismaClassRepository", () => {
  let repository: PrismaClassRepository;
  let enrollmentDelegate: EnrollmentDelegateMock;
  let prisma: { enrollment: EnrollmentDelegateMock };
  let queryService: jest.Mocked<PrismaQueryService>;

  const classRowFactory = (overrides: Record<string, unknown> = {}) => ({
    id: "class-1",
    name: "Lop Mam 1A",
    description: null,
    campusId: "campus-1",
    gradeLevelId: "grade-1",
    schoolYearId: "year-1",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    gradeLevel: {
      id: "grade-1",
      name: "Mam",
      order: 1,
      isArchived: false,
      campusId: "campus-1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    schoolYear: {
      id: "year-1",
      name: "2026-2027",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-06-30T00:00:00.000Z"),
      isArchived: false,
      campusId: "campus-1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    staff: [
      {
        role: ClassStaffRole.HOMEROOM,
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        staff: { id: "staff-1", fullName: "Teacher One" },
      },
    ],
    ...overrides,
  });

  beforeEach(() => {
    enrollmentDelegate = {
      groupBy: jest.fn(),
    };
    prisma = {
      enrollment: enrollmentDelegate,
    };
    queryService = {
      executeQuery: jest.fn(),
    } as unknown as jest.Mocked<PrismaQueryService>;

    repository = new PrismaClassRepository(
      prisma as unknown as PrismaService,
      queryService,
    );
  });

  describe("findAll", () => {
    it("computes active, upcoming, and closed historical counts at one UTC boundary", async () => {
      queryService.executeQuery.mockResolvedValue({
        data: [
          classRowFactory({ id: "class-1" }),
          classRowFactory({
            id: "class-2",
            name: "Lop Mam 1B",
            gradeLevel: null,
            schoolYear: null,
            staff: [],
          }),
          classRowFactory({ id: "class-3", name: "Lop Mam 1C", staff: [] }),
        ],
        pagination: {
          count: 3,
          limit: 10,
          offset: 0,
          totalPages: 1,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
      enrollmentDelegate.groupBy
        .mockResolvedValueOnce([{ classId: "class-1", _count: { _all: 2 } }])
        .mockResolvedValueOnce([
          { classId: "class-1", _count: { _all: 3 } },
          { classId: "class-3", _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([
          { classId: "class-1", _count: { _all: 5 } },
          { classId: "class-2", _count: { _all: 1 } },
        ]);
      const params: StandardRequest = {
        filter: '{"schoolYearId":"year-1"}',
      };

      const referenceDate = new Date("2026-07-11T23:59:59.999Z");
      const referenceDay = new Date("2026-07-11T00:00:00.000Z");
      const result = await repository.findAll(
        "campus-1",
        params,
        referenceDate,
      );

      expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
      const [, modelName, passedParams, options, mapper] =
        queryService.executeQuery.mock.calls[0];
      expect(modelName).toBe("class");
      expect(mapper).toBeNull();
      expect((passedParams as StandardRequest).filter).toBe(
        '{"schoolYearId":"year-1"}',
      );
      expect((passedParams as StandardRequest).allowedFilterFields).toEqual([
        "name",
        "description",
        "gradeLevelId",
        "schoolYearId",
      ]);
      expect(options).toMatchObject({
        where: { campusId: "campus-1" },
        include: {
          gradeLevel: true,
          schoolYear: true,
          staff: {
            include: { staff: { select: { id: true, fullName: true } } },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          },
        },
      });
      expect(enrollmentDelegate.groupBy).toHaveBeenNthCalledWith(1, {
        by: ["classId"],
        where: {
          classId: { in: ["class-1", "class-2", "class-3"] },
          cancelledAt: null,
          enrollmentDate: { lte: referenceDay },
          OR: [{ endDate: null }, { endDate: { gte: referenceDay } }],
        },
        _count: { _all: true },
      });
      expect(enrollmentDelegate.groupBy).toHaveBeenNthCalledWith(2, {
        by: ["classId"],
        where: {
          classId: { in: ["class-1", "class-2", "class-3"] },
          cancelledAt: null,
          enrollmentDate: { gt: referenceDay },
        },
        _count: { _all: true },
      });
      expect(enrollmentDelegate.groupBy).toHaveBeenNthCalledWith(3, {
        by: ["classId"],
        where: {
          classId: { in: ["class-1", "class-2", "class-3"] },
          cancelledAt: null,
          endDate: { lt: referenceDay },
        },
        _count: { _all: true },
      });

      expect(result.data).toHaveLength(3);
      expect(result.data[0]).toMatchObject({
        id: "class-1",
        activeStudentCount: 2,
        upcomingStudentCount: 3,
        historicalStudentCount: 5,
      });
      expect(result.data[1]).toMatchObject({
        id: "class-2",
        activeStudentCount: 0,
        upcomingStudentCount: 0,
        historicalStudentCount: 1,
        gradeLevel: null,
        schoolYear: null,
        staff: [],
      });
      expect(result.data[2]).toMatchObject({
        id: "class-3",
        activeStudentCount: 0,
        upcomingStudentCount: 1,
        historicalStudentCount: 0,
      });
      expect(result.data[0].staff).toEqual([
        {
          id: "staff-1",
          fullName: "Teacher One",
          role: ClassStaffRole.HOMEROOM,
        },
      ]);
    });

    it("skips count queries for an empty page", async () => {
      queryService.executeQuery.mockResolvedValue({
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
      });

      const result = await repository.findAll(
        "campus-1",
        {},
        new Date("2026-07-11T00:00:00.000Z"),
      );

      expect(result.data).toEqual([]);
      expect(enrollmentDelegate.groupBy).not.toHaveBeenCalled();
    });
  });
});
