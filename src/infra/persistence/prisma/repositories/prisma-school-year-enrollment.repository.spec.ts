import { PrismaSchoolYearEnrollmentRepository } from "./prisma-school-year-enrollment.repository";
import { PrismaService } from "../prisma.service";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";

type SyeDelegateMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

type EnrollmentDelegateMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

describe("PrismaSchoolYearEnrollmentRepository", () => {
  let repository: PrismaSchoolYearEnrollmentRepository;
  let syeDelegate: SyeDelegateMock;
  let enrollmentDelegate: EnrollmentDelegateMock;
  let prisma: {
    schoolYearEnrollment: SyeDelegateMock;
    enrollment: EnrollmentDelegateMock;
    $transaction: jest.Mock;
  };
  let queryService: jest.Mocked<PrismaQueryService>;

  // Canonical Prisma row with the three relations the repo always includes.
  // The mapper consumes these to hydrate the nested domain entities.
  const prismaRowFactory = (overrides: Record<string, unknown> = {}) => ({
    id: "sye-1",
    studentId: "student-1",
    campusId: "campus-1",
    schoolYearId: "year-1",
    gradeLevelId: "grade-1",
    enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    exitDate: null,
    exitReason: null,
    note: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    student: {
      id: "student-1",
      campusId: "campus-1",
      fullName: "Nguyễn Văn A",
      nickname: null,
      studentCode: "2026-000001",
      email: null,
      phoneNumber: null,
      dateOfBirth: new Date("2020-01-01T00:00:00.000Z"),
      gender: "MALE",
      address: null,
      avatarUrl: null,
      status: "ACTIVE",
      enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      gradeLevelId: null,
      classId: null,
      notes: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
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
    gradeLevel: {
      id: "grade-1",
      name: "Mầm",
      order: 1,
      isArchived: false,
      campusId: "campus-1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    ...overrides,
  });

  // The enrollment delegate is only needed by `withdrawWithChildren`; build it
  // here so its row shape is centralized and easy to evolve.
  const enrollmentRowFactory = (overrides: Record<string, unknown> = {}) => ({
    id: "enrollment-1",
    classId: "class-1",
    studentId: "student-1",
    schoolYearEnrollmentId: "sye-1",
    enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: null,
    exitReason: null,
    note: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    class: {
      id: "class-1",
      name: "Lớp A1",
      campusId: "campus-1",
      gradeLevelId: "grade-1",
      schoolYearId: "year-1",
      description: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    student: {
      id: "student-1",
      campusId: "campus-1",
      fullName: "Nguyễn Văn A",
      nickname: null,
      studentCode: "2026-000001",
      email: null,
      phoneNumber: null,
      dateOfBirth: new Date("2020-01-01T00:00:00.000Z"),
      gender: "MALE",
      address: null,
      avatarUrl: null,
      status: "ACTIVE",
      enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      gradeLevelId: null,
      classId: null,
      notes: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    },
    ...overrides,
  });

  beforeEach(() => {
    syeDelegate = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    enrollmentDelegate = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    prisma = {
      schoolYearEnrollment: syeDelegate,
      enrollment: enrollmentDelegate,
      $transaction: jest.fn(),
    };
    queryService = {
      executeQuery: jest.fn(),
    } as unknown as jest.Mocked<PrismaQueryService>;
    repository = new PrismaSchoolYearEnrollmentRepository(
      prisma as unknown as PrismaService,
      queryService,
    );
  });

  describe("findById", () => {
    it("includes nested relations and returns the mapped entity", async () => {
      syeDelegate.findUnique.mockResolvedValue(prismaRowFactory());

      const result = await repository.findById("sye-1");

      expect(syeDelegate.findUnique).toHaveBeenCalledWith({
        where: { id: "sye-1" },
        include: { student: true, schoolYear: true, gradeLevel: true },
      });
      expect(result).not.toBeNull();
      expect(result!.id).toBe("sye-1");
      expect(result!.studentId).toBe("student-1");
      expect(result!.gradeLevelId).toBe("grade-1");
      expect(result!.isActive()).toBe(true);
      // Nested domain entities hydrate from the include payload.
      expect(result!.schoolYear).toBeDefined();
      expect(result!.gradeLevel).toBeDefined();
      expect(result!.student).toBeDefined();
    });

    it("returns null when no row matches", async () => {
      syeDelegate.findUnique.mockResolvedValue(null);

      const result = await repository.findById("missing");

      expect(result).toBeNull();
    });
  });

  describe("findOpenByStudentAndSchoolYear", () => {
    it("queries with exitDate=null and returns the open parent", async () => {
      syeDelegate.findFirst.mockResolvedValue(prismaRowFactory());

      const result = await repository.findOpenByStudentAndSchoolYear(
        "student-1",
        "year-1",
      );

      expect(syeDelegate.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: "student-1",
          schoolYearId: "year-1",
          exitDate: null,
          cancelledAt: null,
        },
        include: { student: true, schoolYear: true, gradeLevel: true },
      });
      expect(result).not.toBeNull();
      expect(result!.isActive()).toBe(true);
      expect(result!.exitDate).toBeNull();
    });

    it("returns null when the student has no open parent for that year", async () => {
      syeDelegate.findFirst.mockResolvedValue(null);

      const result = await repository.findOpenByStudentAndSchoolYear(
        "student-1",
        "year-1",
      );

      expect(result).toBeNull();
    });
  });

  describe("date-effective parent lookups", () => {
    it("finds an uncancelled parent covering the effective UTC date inclusively", async () => {
      syeDelegate.findFirst.mockResolvedValue(prismaRowFactory());

      await repository.findCoveringDateByStudentAndSchoolYear(
        "student-1",
        "year-1",
        new Date("2026-01-15T18:30:00.000Z"),
      );

      expect(syeDelegate.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: "student-1",
          schoolYearId: "year-1",
          cancelledAt: null,
          enrollmentDate: { lte: new Date("2026-01-15T00:00:00.000Z") },
          OR: [
            { exitDate: null },
            { exitDate: { gte: new Date("2026-01-15T00:00:00.000Z") } },
          ],
        },
        include: { student: true, schoolYear: true, gradeLevel: true },
        orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
      });
    });

    it("returns future uncancelled parents in deterministic order", async () => {
      syeDelegate.findMany.mockResolvedValue([]);

      await repository.findUpcomingByStudentAndSchoolYear(
        "student-1",
        "year-1",
        new Date("2026-01-15T23:59:00.000Z"),
      );

      expect(syeDelegate.findMany).toHaveBeenCalledWith({
        where: {
          studentId: "student-1",
          schoolYearId: "year-1",
          cancelledAt: null,
          enrollmentDate: { gt: new Date("2026-01-15T00:00:00.000Z") },
        },
        include: { student: true, schoolYear: true, gradeLevel: true },
        orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
      });
    });
  });

  describe("findAllByStudentId", () => {
    it("orders by enrollmentDate desc and hydrates closed rows too", async () => {
      syeDelegate.findMany.mockResolvedValue([
        prismaRowFactory({ id: "sye-current" }),
        prismaRowFactory({
          id: "sye-prev",
          schoolYearId: "year-0",
          enrollmentDate: new Date("2025-09-01T00:00:00.000Z"),
          exitDate: new Date("2026-06-30T00:00:00.000Z"),
          exitReason: "COMPLETED",
        }),
      ]);

      const result = await repository.findAllByStudentId("student-1");

      expect(syeDelegate.findMany).toHaveBeenCalledWith({
        where: { studentId: "student-1" },
        include: { student: true, schoolYear: true, gradeLevel: true },
        orderBy: { enrollmentDate: "desc" },
      });
      expect(result).toHaveLength(2);
      const closed = result.find((r) => !r.isActive())!;
      expect(closed.exitReason).toBe(ExitReason.COMPLETED);
      expect(closed.exitDate).toEqual(new Date("2026-06-30T00:00:00.000Z"));
    });

    it("returns an empty array when the student has no parents", async () => {
      syeDelegate.findMany.mockResolvedValue([]);

      const result = await repository.findAllByStudentId("student-1");

      expect(result).toEqual([]);
    });
  });

  describe("findAllByStudentIdWithChildCount", () => {
    it("retains all parent history while counting only uncancelled children", async () => {
      syeDelegate.findMany.mockResolvedValue([
        { ...prismaRowFactory(), _count: { enrollments: 2 } },
      ]);

      const result =
        await repository.findAllByStudentIdWithChildCount("student-1");

      expect(syeDelegate.findMany).toHaveBeenCalledWith({
        where: { studentId: "student-1" },
        include: {
          student: true,
          schoolYear: true,
          gradeLevel: true,
          _count: {
            select: { enrollments: { where: { cancelledAt: null } } },
          },
        },
        orderBy: { enrollmentDate: "desc" },
      });
      expect(result[0].childEnrollmentCount).toBe(2);
    });
  });

  describe("save", () => {
    it("passes the create payload through and returns the mapped row", async () => {
      const entity = SchoolYearEnrollment.create(
        {
          studentId: "student-1",
          campusId: "campus-1",
          schoolYearId: "year-1",
          gradeLevelId: "grade-1",
          enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
          note: "Registered with paperwork",
        },
        "sye-new",
      );
      syeDelegate.create.mockResolvedValue(
        prismaRowFactory({ id: "sye-new", note: "Registered with paperwork" }),
      );

      const result = await repository.save(entity);

      const createArg = syeDelegate.create.mock.calls[0][0];
      expect(createArg.data.id).toBe("sye-new");
      expect(createArg.data.studentId).toBe("student-1");
      expect(createArg.data.gradeLevelId).toBe("grade-1");
      expect(createArg.data.exitDate).toBeNull();
      expect(createArg.include).toEqual({
        student: true,
        schoolYear: true,
        gradeLevel: true,
      });
      expect(result.id).toBe("sye-new");
      expect(result.note).toBe("Registered with paperwork");
    });
  });

  describe("update", () => {
    it("uses UncheckedUpdateInput shape that strips immutable FKs and createdAt", async () => {
      // Build a parent and "close" it via withdraw → that's the canonical mutation
      // the repo update path serves. We use it here purely to get a closed entity
      // whose mapper output we can inspect.
      const open = SchoolYearEnrollment.create(
        {
          studentId: "student-1",
          campusId: "campus-1",
          schoolYearId: "year-1",
          gradeLevelId: "grade-1",
          enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
        },
        "sye-1",
      );
      const closed = open.withdraw(
        new Date("2026-04-15T00:00:00.000Z"),
        ExitReason.WITHDRAWN,
      );
      syeDelegate.update.mockResolvedValue(
        prismaRowFactory({
          id: closed.id,
          exitDate: new Date("2026-04-15T00:00:00.000Z"),
          exitReason: "WITHDRAWN",
        }),
      );

      const result = await repository.update(closed);

      const updateArg = syeDelegate.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: closed.id });
      // Mutable fields go through…
      expect(updateArg.data.exitDate).toEqual(
        new Date("2026-04-15T00:00:00.000Z"),
      );
      expect(updateArg.data.exitReason).toBe(ExitReason.WITHDRAWN);
      expect(updateArg.data.enrollmentDate).toEqual(
        new Date("2026-01-15T00:00:00.000Z"),
      );
      expect(updateArg.data.note).toBeNull();
      expect(updateArg.data.updatedAt).toBeInstanceOf(Date);
      // …and the four immutable FKs + createdAt are NOT in the payload.
      expect(updateArg.data).not.toHaveProperty("studentId");
      expect(updateArg.data).not.toHaveProperty("campusId");
      expect(updateArg.data).not.toHaveProperty("schoolYearId");
      expect(updateArg.data).not.toHaveProperty("gradeLevelId");
      expect(updateArg.data).not.toHaveProperty("createdAt");
      expect(updateArg.data).not.toHaveProperty("id");

      expect(result.isActive()).toBe(false);
      expect(result.exitReason).toBe(ExitReason.WITHDRAWN);
    });
  });

  describe("countChildEnrollments", () => {
    it("counts child enrollment rows by schoolYearEnrollmentId", async () => {
      enrollmentDelegate.count.mockResolvedValue(2);

      const result = await repository.countChildEnrollments("sye-1");

      expect(enrollmentDelegate.count).toHaveBeenCalledWith({
        where: { schoolYearEnrollmentId: "sye-1" },
      });
      expect(result).toBe(2);
    });
  });

  describe("findStudentsBySchoolYear", () => {
    it("routes through StandardRequest pagination with campus/year scope, segment, search, and relation includes", async () => {
      const activeChild = enrollmentRowFactory({
        id: "enrollment-active",
        enrollmentDate: new Date("2026-07-01T00:00:00.000Z"),
        endDate: null,
      });
      queryService.executeQuery.mockResolvedValue({
        data: [
          {
            ...prismaRowFactory({
              id: "sye-active",
              snapshotStudentFullName: "Snapshot Bé A",
            }),
            enrollments: [activeChild],
            _count: { enrollments: 1 },
          },
        ],
        pagination: {
          count: 1,
          limit: 10,
          offset: 0,
          totalPages: 1,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const result = await repository.findStudentsBySchoolYear(
        "campus-1",
        "year-1",
        { limit: 10, offset: 0, sort: "-enrollmentDate" },
        new Date("2026-07-11T23:59:59.999Z"),
        { segment: "active", search: "bé a" },
      );

      expect(queryService.executeQuery).toHaveBeenCalledTimes(1);
      const [, modelName, params, options] =
        queryService.executeQuery.mock.calls[0];
      const queryOptions = options!;
      const where = queryOptions.where!;
      const include = queryOptions.include!;
      expect(modelName).toBe("schoolYearEnrollment");
      expect(params.allowedFilterFields).toEqual([
        "studentId",
        "gradeLevelId",
        "enrollmentDate",
        "exitDate",
        "exitReason",
      ]);
      expect(params.allowedSortFields).toEqual([
        "enrollmentDate",
        "exitDate",
        "createdAt",
      ]);
      expect(where).toMatchObject({
        campusId: "campus-1",
        schoolYearId: "year-1",
      });
      expect(where.AND).toEqual(
        expect.arrayContaining([
          {
            cancelledAt: null,
            enrollmentDate: { lte: new Date("2026-07-11T00:00:00.000Z") },
            OR: [
              { exitDate: null },
              { exitDate: { gte: new Date("2026-07-11T00:00:00.000Z") } },
            ],
            enrollments: {
              some: {
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
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      );
      expect(include).toMatchObject({
        student: true,
        schoolYear: true,
        gradeLevel: true,
        _count: {
          select: { enrollments: { where: { cancelledAt: null } } },
        },
      });
      expect(include.enrollments.include.class.include).toEqual({
        schoolYear: true,
        gradeLevel: true,
      });
      expect(result.data[0].enrollment.id).toBe("sye-active");
      expect(result.data[0].classAssignment!.id).toBe("enrollment-active");
      expect(result.data[0].classAssignmentState).toBe("ACTIVE");
      expect(result.data[0].childEnrollmentCount).toBe(1);
    });

    it("keeps completed and graduated segments distinct", async () => {
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

      await repository.findStudentsBySchoolYear(
        "campus-1",
        "year-1",
        {},
        new Date("2026-07-11T12:00:00.000Z"),
        { segment: "completed" },
      );
      await repository.findStudentsBySchoolYear(
        "campus-1",
        "year-1",
        {},
        new Date("2026-07-11T12:00:00.000Z"),
        { segment: "graduated" },
      );

      expect(
        queryService.executeQuery.mock.calls[0][3]!.where!.AND,
      ).toContainEqual({
        cancelledAt: null,
        exitDate: { lt: new Date("2026-07-11T00:00:00.000Z") },
        exitReason: ExitReason.COMPLETED,
      });
      expect(
        queryService.executeQuery.mock.calls[1][3]!.where!.AND,
      ).toContainEqual({
        cancelledAt: null,
        exitDate: { lt: new Date("2026-07-11T00:00:00.000Z") },
        exitReason: ExitReason.GRADUATED,
      });
    });

    it("uses a date-effective upcoming segment and assignment state", async () => {
      const upcomingChild = enrollmentRowFactory({
        id: "enrollment-upcoming",
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      });
      queryService.executeQuery.mockResolvedValue({
        data: [
          {
            ...prismaRowFactory({ id: "sye-upcoming" }),
            enrollments: [upcomingChild],
            _count: { enrollments: 1 },
          },
        ],
        pagination: {
          count: 1,
          limit: 10,
          offset: 0,
          totalPages: 1,
          currentPage: 1,
          hasNext: false,
          hasPrev: false,
        },
      });

      const result = await repository.findStudentsBySchoolYear(
        "campus-1",
        "year-1",
        {},
        new Date("2026-07-11T23:59:59.999Z"),
        { segment: "upcoming" },
      );

      expect(
        queryService.executeQuery.mock.calls[0][3]!.where!.AND,
      ).toContainEqual({
        cancelledAt: null,
        enrollmentDate: { gt: new Date("2026-07-11T00:00:00.000Z") },
      });
      expect(result.data[0].classAssignmentState).toBe("UPCOMING");
    });

    it("keeps future parents out of unassigned with date-effective predicates", async () => {
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

      await repository.findStudentsBySchoolYear(
        "campus-1",
        "year-1",
        {},
        new Date("2026-07-11T23:59:59.999Z"),
        { segment: "unassigned" },
      );

      expect(
        queryService.executeQuery.mock.calls[0][3]!.where!.AND,
      ).toContainEqual({
        cancelledAt: null,
        enrollmentDate: { lte: new Date("2026-07-11T00:00:00.000Z") },
        OR: [
          { exitDate: null },
          { exitDate: { gte: new Date("2026-07-11T00:00:00.000Z") } },
        ],
        enrollments: {
          none: {
            cancelledAt: null,
            OR: [
              { endDate: null },
              {
                endDate: { gte: new Date("2026-07-11T00:00:00.000Z") },
              },
            ],
          },
        },
      });
    });

    it("prioritizes active, then upcoming, closed, and cancelled assignments", async () => {
      const referenceDate = new Date("2026-07-11T00:00:00.000Z");
      const active = enrollmentRowFactory({
        id: "active",
        enrollmentDate: new Date("2026-07-01T00:00:00.000Z"),
      });
      const upcoming = enrollmentRowFactory({ id: "upcoming" });
      const closed = enrollmentRowFactory({
        id: "closed",
        enrollmentDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-06-30T00:00:00.000Z"),
        exitReason: "WITHDRAWN",
      });
      const cancelled = enrollmentRowFactory({
        id: "cancelled",
        cancelledAt: new Date("2026-07-01T00:00:00.000Z"),
        cancellationReason: "FAMILY_REQUEST",
        cancellationNote: null,
        cancelledByUserId: "actor-1",
        cancelledByFullName: "Alice Admin",
      });
      const states = [
        [[cancelled], "CANCELLED"],
        [[cancelled, closed], "CLOSED"],
        [[cancelled, closed, upcoming], "UPCOMING"],
        [[cancelled, closed, upcoming, active], "ACTIVE"],
      ] as const;

      for (const [enrollments, expectedState] of states) {
        queryService.executeQuery.mockResolvedValueOnce({
          data: [
            {
              ...prismaRowFactory(),
              enrollments: [...enrollments],
              _count: { enrollments: enrollments.length },
            },
          ],
          pagination: {
            count: 1,
            limit: 10,
            offset: 0,
            totalPages: 1,
            currentPage: 1,
            hasNext: false,
            hasPrev: false,
          },
        });

        const result = await repository.findStudentsBySchoolYear(
          "campus-1",
          "year-1",
          {},
          referenceDate,
        );

        expect(result.data[0].classAssignmentState).toBe(expectedState);
      }
    });
  });

  describe("correctGradeLevel", () => {
    it("updates only gradeLevelId and updatedAt through the dedicated path", async () => {
      syeDelegate.update.mockResolvedValue(
        prismaRowFactory({ gradeLevelId: "grade-2" }),
      );

      const result = await repository.correctGradeLevel("sye-1", "grade-2");

      const updateArg = syeDelegate.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: "sye-1" });
      expect(updateArg.data.gradeLevelId).toBe("grade-2");
      expect(updateArg.data.updatedAt).toBeInstanceOf(Date);
      expect(updateArg.data).not.toHaveProperty("studentId");
      expect(updateArg.data).not.toHaveProperty("campusId");
      expect(updateArg.data).not.toHaveProperty("schoolYearId");
      expect(updateArg.data).not.toHaveProperty("enrollmentDate");
      expect(updateArg.include).toEqual({
        student: true,
        schoolYear: true,
        gradeLevel: true,
      });
      expect(result.gradeLevelId).toBe("grade-2");
    });

    it("uses the supplied transaction client when provided", async () => {
      const txSye: SyeDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      txSye.update.mockResolvedValue(
        prismaRowFactory({ gradeLevelId: "grade-2" }),
      );

      await repository.correctGradeLevel("sye-1", "grade-2", {
        schoolYearEnrollment: txSye,
      } as unknown as AppTransactionClient);

      expect(txSye.update).toHaveBeenCalledTimes(1);
      expect(syeDelegate.update).not.toHaveBeenCalled();
    });
  });

  describe("withdrawWithChildren (atomic cascade)", () => {
    // Helpers — keep the shared fixture set small but realistic.
    const buildOpenParent = () =>
      SchoolYearEnrollment.create(
        {
          studentId: "student-1",
          campusId: "campus-1",
          schoolYearId: "year-1",
          gradeLevelId: "grade-1",
          enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
        },
        "sye-1",
      );

    const buildClosedParent = () =>
      buildOpenParent().withdraw(
        new Date("2026-04-15T00:00:00.000Z"),
        ExitReason.WITHDRAWN,
      );

    const buildClosedChild = () =>
      Enrollment.create(
        {
          classId: "class-1",
          studentId: "student-1",
          schoolYearEnrollmentId: "sye-1",
          enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
          endDate: new Date("2026-04-15T00:00:00.000Z"),
          exitReason: ExitReason.WITHDRAWN,
          note: null,
        },
        "enrollment-1",
      );

    it("runs both ops inside a single $transaction and returns mapped entities", async () => {
      // Tx delegates distinct from the outer ones so we can prove the writes
      // happened on the tx client (i.e. inside the transaction wrapper).
      const txSye: SyeDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const txEnrollment: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const parent = buildClosedParent();
      const child = buildClosedChild();

      txSye.update.mockResolvedValue(
        prismaRowFactory({
          id: parent.id,
          exitDate: new Date("2026-04-15T00:00:00.000Z"),
          exitReason: "WITHDRAWN",
        }),
      );
      txEnrollment.update.mockResolvedValue(
        enrollmentRowFactory({
          id: child.id,
          endDate: new Date("2026-04-15T00:00:00.000Z"),
          exitReason: "WITHDRAWN",
        }),
      );

      prisma.$transaction.mockImplementation(async (work) =>
        work({ schoolYearEnrollment: txSye, enrollment: txEnrollment }),
      );

      const result = await repository.withdrawWithChildren(parent, child);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txSye.update).toHaveBeenCalledTimes(1);
      expect(txEnrollment.update).toHaveBeenCalledTimes(1);
      // Nothing leaked outside the tx wrapper.
      expect(syeDelegate.update).not.toHaveBeenCalled();
      expect(enrollmentDelegate.update).not.toHaveBeenCalled();

      // Parent update targets the right row + carries the closing fields.
      const parentArg = txSye.update.mock.calls[0][0];
      expect(parentArg.where).toEqual({ id: parent.id });
      expect(parentArg.data.exitDate).toEqual(parent.exitDate);
      expect(parentArg.data.exitReason).toBe(parent.exitReason);

      // Child update targets the right row + uses the closed-child payload.
      const childArg = txEnrollment.update.mock.calls[0][0];
      expect(childArg.where).toEqual({ id: child.id });
      expect(childArg.data.endDate).toEqual(child.endDate);
      expect(childArg.data.exitReason).toBe(child.exitReason);

      expect(result.closedParent.id).toBe(parent.id);
      expect(result.closedParent.isActive()).toBe(false);
      expect(result.closedChild).not.toBeNull();
      expect(result.closedChild!.id).toBe(child.id);
      expect(result.closedChild!.isActive()).toBe(false);
    });

    it("when openChild is null, closes the parent only and never touches enrollment", async () => {
      const txSye: SyeDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const txEnrollment: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const parent = buildClosedParent();

      txSye.update.mockResolvedValue(
        prismaRowFactory({
          id: parent.id,
          exitDate: new Date("2026-04-15T00:00:00.000Z"),
          exitReason: "WITHDRAWN",
        }),
      );
      prisma.$transaction.mockImplementation(async (work) =>
        work({ schoolYearEnrollment: txSye, enrollment: txEnrollment }),
      );

      const result = await repository.withdrawWithChildren(parent, null);

      expect(txSye.update).toHaveBeenCalledTimes(1);
      expect(txEnrollment.update).not.toHaveBeenCalled();
      expect(result.closedParent.id).toBe(parent.id);
      expect(result.closedChild).toBeNull();
    });

    it("rolls back when the child update fails (AC-8 — parent stays open in real Prisma)", async () => {
      const txSye: SyeDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const txEnrollment: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const parent = buildClosedParent();
      const child = buildClosedChild();

      txSye.update.mockResolvedValue(prismaRowFactory({ id: parent.id }));
      // Force the child write to fail — in real Prisma the surrounding
      // $transaction would roll back the parent update as well.
      txEnrollment.update.mockRejectedValue(
        new Error("FK violation: enrollment"),
      );

      prisma.$transaction.mockImplementation(async (work) =>
        work({ schoolYearEnrollment: txSye, enrollment: txEnrollment }),
      );

      await expect(
        repository.withdrawWithChildren(parent, child),
      ).rejects.toThrow("FK violation: enrollment");

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txSye.update).toHaveBeenCalledTimes(1);
      expect(txEnrollment.update).toHaveBeenCalledTimes(1);
      // Crucially, no writes happened outside the tx — proving wrapping is
      // intact, which is what guarantees rollback semantics in real Prisma.
      expect(syeDelegate.update).not.toHaveBeenCalled();
      expect(enrollmentDelegate.update).not.toHaveBeenCalled();
    });

    it("rolls back when the parent update fails and never attempts the child", async () => {
      const txSye: SyeDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const txEnrollment: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const parent = buildClosedParent();
      const child = buildClosedChild();

      txSye.update.mockRejectedValue(new Error("Record to update not found"));

      prisma.$transaction.mockImplementation(async (work) =>
        work({ schoolYearEnrollment: txSye, enrollment: txEnrollment }),
      );

      await expect(
        repository.withdrawWithChildren(parent, child),
      ).rejects.toThrow("Record to update not found");

      expect(txSye.update).toHaveBeenCalledTimes(1);
      expect(txEnrollment.update).not.toHaveBeenCalled();
    });
  });

  describe("mapper round-trip via findById", () => {
    it("hydrates exitDate and exitReason for a closed parent", async () => {
      syeDelegate.findUnique.mockResolvedValue(
        prismaRowFactory({
          exitDate: new Date("2027-06-15T00:00:00.000Z"),
          exitReason: "GRADUATED",
        }),
      );

      const result = await repository.findById("sye-1");

      expect(result).not.toBeNull();
      expect(result!.exitDate).toEqual(new Date("2027-06-15T00:00:00.000Z"));
      expect(result!.exitReason).toBe(ExitReason.GRADUATED);
      expect(result!.isActive()).toBe(false);
    });

    it("coerces unknown exitReason strings to null without throwing", async () => {
      syeDelegate.findUnique.mockResolvedValue(
        prismaRowFactory({
          exitDate: new Date("2027-06-15T00:00:00.000Z"),
          exitReason: "SOMETHING_NEW_FROM_THE_FUTURE",
        }),
      );

      // The mapper is tolerant: it strips unknown enum values so the domain
      // factory's XOR invariant kicks in. The test asserts the factory raises
      // — which is the correct behavior when the DB hands us a bogus reason.
      await expect(repository.findById("sye-1")).rejects.toThrow(
        /both be set or both be null/i,
      );
    });
  });
});
