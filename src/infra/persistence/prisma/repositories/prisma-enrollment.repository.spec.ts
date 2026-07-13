import { PrismaEnrollmentRepository } from "./prisma-enrollment.repository";
import { PrismaService } from "../prisma.service";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { EnrollmentEffectiveStatusFilter } from "@/application/class-management/enrollment-effective-status-filter";

type EnrollmentDelegateMock = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

describe("PrismaEnrollmentRepository", () => {
  let repository: PrismaEnrollmentRepository;
  let enrollmentDelegate: EnrollmentDelegateMock;
  let prisma: {
    enrollment: EnrollmentDelegateMock;
    $transaction: jest.Mock;
  };
  let queryService: jest.Mocked<PrismaQueryService>;

  const enrollmentInclude = {
    class: {
      include: {
        schoolYear: true,
        gradeLevel: true,
      },
    },
    student: true,
  };

  // A canonical Prisma row used to assert mapping behavior. Includes the
  // class/student relations that the repository queries always request via
  // `include`, so the mapper can hydrate the domain entity.
  const prismaRowFactory = (overrides: Record<string, unknown> = {}) => ({
    id: "enrollment-1",
    classId: "class-1",
    studentId: "student-1",
    schoolYearEnrollmentId: "sye-1",
    enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
    endDate: null,
    exitReason: null,
    note: null,
    createdAt: new Date("2026-01-15T00:00:00.000Z"),
    updatedAt: new Date("2026-01-15T00:00:00.000Z"),
    class: {
      id: "class-1",
      name: "Lớp A1",
      campusId: "campus-1",
      gradeLevelId: "grade-1",
      schoolYearId: "year-1",
      description: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    student: {
      id: "student-1",
      campusId: "campus-1",
      fullName: "Nguyễn Văn A",
      nickname: null,
      studentCode: "STU001",
      email: null,
      phoneNumber: null,
      dateOfBirth: new Date("2020-01-01T00:00:00.000Z"),
      gender: "MALE",
      address: null,
      avatarUrl: null,
      status: "ACTIVE",
      enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
      gradeLevelId: null,
      classId: null,
      notes: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    ...overrides,
  });

  beforeEach(() => {
    enrollmentDelegate = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    prisma = {
      enrollment: enrollmentDelegate,
      $transaction: jest.fn(),
    };
    queryService = {
      executeQuery: jest.fn(),
    } as unknown as jest.Mocked<PrismaQueryService>;

    repository = new PrismaEnrollmentRepository(
      prisma as unknown as PrismaService,
      queryService,
    );
  });

  describe("findActiveByStudentId", () => {
    it("queries with endDate=null and returns the mapped entity", async () => {
      enrollmentDelegate.findFirst.mockResolvedValue(prismaRowFactory());

      const result = await repository.findActiveByStudentId("student-1");

      expect(enrollmentDelegate.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: "student-1",
          endDate: null,
          cancelledAt: null,
        },
        include: enrollmentInclude,
        orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
      });
      expect(result).not.toBeNull();
      expect(result!.studentId).toBe("student-1");
      expect(result!.endDate).toBeNull();
      expect(result!.exitReason).toBeNull();
      expect(result!.isActive()).toBe(true);
    });

    it("returns null when no active enrollment exists", async () => {
      enrollmentDelegate.findFirst.mockResolvedValue(null);

      const result = await repository.findActiveByStudentId("student-1");

      expect(result).toBeNull();
    });
  });

  describe("date-effective enrollment lookups", () => {
    it("finds the uncancelled row covering the UTC date inclusively", async () => {
      enrollmentDelegate.findFirst.mockResolvedValue(prismaRowFactory());

      await repository.findEffectiveByStudentIdAt(
        "student-1",
        new Date("2026-01-15T18:30:00.000Z"),
      );

      expect(enrollmentDelegate.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: "student-1",
          cancelledAt: null,
          enrollmentDate: { lte: new Date("2026-01-15T00:00:00.000Z") },
          OR: [
            { endDate: null },
            { endDate: { gte: new Date("2026-01-15T00:00:00.000Z") } },
          ],
        },
        include: enrollmentInclude,
        orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
      });
    });

    it("finds future uncancelled rows in deterministic date order", async () => {
      enrollmentDelegate.findMany.mockResolvedValue([]);

      await repository.findUpcomingByStudentId(
        "student-1",
        new Date("2026-01-15T23:59:00.000Z"),
      );

      expect(enrollmentDelegate.findMany).toHaveBeenCalledWith({
        where: {
          studentId: "student-1",
          cancelledAt: null,
          enrollmentDate: { gt: new Date("2026-01-15T00:00:00.000Z") },
        },
        include: enrollmentInclude,
        orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
      });
    });

    it("detects inclusive overlap while excluding the source transfer row", async () => {
      enrollmentDelegate.findFirst.mockResolvedValue(null);

      await repository.findOverlappingByStudentId(
        "student-1",
        new Date("2026-02-01T17:00:00.000Z"),
        new Date("2026-02-28T17:00:00.000Z"),
        "source-enrollment",
      );

      expect(enrollmentDelegate.findFirst).toHaveBeenCalledWith({
        where: {
          studentId: "student-1",
          cancelledAt: null,
          id: { not: "source-enrollment" },
          enrollmentDate: { lte: new Date("2026-02-28T00:00:00.000Z") },
          OR: [
            { endDate: null },
            { endDate: { gte: new Date("2026-02-01T00:00:00.000Z") } },
          ],
        },
        include: enrollmentInclude,
        orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
      });
    });
  });

  describe("findByClassIdAndEffectiveStatus", () => {
    const referenceDate = new Date("2026-07-11T23:59:59.999Z");
    const referenceDay = new Date("2026-07-11T00:00:00.000Z");

    it.each([
      [
        EnrollmentEffectiveStatusFilter.ACTIVE,
        {
          cancelledAt: null,
          enrollmentDate: { lte: referenceDay },
          OR: [{ endDate: null }, { endDate: { gte: referenceDay } }],
        },
      ],
      [
        EnrollmentEffectiveStatusFilter.UPCOMING,
        { cancelledAt: null, enrollmentDate: { gt: referenceDay } },
      ],
      [
        EnrollmentEffectiveStatusFilter.CLOSED,
        { cancelledAt: null, endDate: { lt: referenceDay } },
      ],
      [
        EnrollmentEffectiveStatusFilter.CANCELLED,
        { cancelledAt: { not: null } },
      ],
      [EnrollmentEffectiveStatusFilter.ALL, {}],
    ])("applies the %s database filter", async (status, statusWhere) => {
      enrollmentDelegate.findMany.mockResolvedValue([prismaRowFactory()]);

      const result = await repository.findByClassIdAndEffectiveStatus(
        "class-1",
        status,
        referenceDate,
      );

      expect(enrollmentDelegate.findMany).toHaveBeenCalledWith({
        where: { classId: "class-1", ...statusWhere },
        include: enrollmentInclude,
        orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
      });
      expect(result).toHaveLength(1);
    });

    it("returns an empty array without changing the filter contract", async () => {
      enrollmentDelegate.findMany.mockResolvedValue([]);

      await expect(
        repository.findByClassIdAndEffectiveStatus(
          "class-1",
          EnrollmentEffectiveStatusFilter.ACTIVE,
          referenceDate,
        ),
      ).resolves.toEqual([]);
    });
  });

  describe("findAllByStudentId", () => {
    it("queries with no endDate filter and includes nested schoolYear and gradeLevel", async () => {
      enrollmentDelegate.findMany.mockResolvedValue([prismaRowFactory()]);

      await repository.findAllByStudentId("student-1");

      expect(enrollmentDelegate.findMany).toHaveBeenCalledWith({
        where: { studentId: "student-1" },
        include: {
          class: {
            include: {
              schoolYear: true,
              gradeLevel: true,
            },
          },
          student: true,
        },
        orderBy: { enrollmentDate: "desc" },
      });
    });

    it("returns the mapped history rows (active + closed)", async () => {
      enrollmentDelegate.findMany.mockResolvedValue([
        prismaRowFactory({
          id: "e-1-old",
          endDate: new Date("2026-02-15T00:00:00.000Z"),
          exitReason: "TRANSFERRED",
        }),
        prismaRowFactory({ id: "e-2-current" }),
      ]);

      const result = await repository.findAllByStudentId("student-1");

      expect(result).toHaveLength(2);
      const closed = result.find((e) => !e.isActive())!;
      expect(closed.exitReason).toBe(ExitReason.TRANSFERRED);
      const active = result.find((e) => e.isActive())!;
      expect(active.endDate).toBeNull();
    });
  });

  describe("transferEnrollment (atomic close + open)", () => {
    // Helper to build a closed enrollment domain entity ready for the repo.
    const buildClosed = () =>
      Enrollment.create(
        {
          classId: "class-source",
          studentId: "student-1",
          schoolYearEnrollmentId: "sye-test",
          enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
          endDate: new Date("2026-01-15T00:00:00.000Z"),
          exitReason: ExitReason.TRANSFERRED,
          note: null,
        },
        "active-1",
      );

    // Helper to build the new opened enrollment in the target class.
    const buildOpened = () =>
      Enrollment.create(
        {
          classId: "class-target",
          studentId: "student-1",
          schoolYearEnrollmentId: "sye-test",
          enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
          note: null,
        },
        "opened-1",
      );

    it("runs both ops inside a single $transaction and returns mapped domain entities", async () => {
      // Inner tx delegate distinct from the outer enrollmentDelegate so we can
      // assert the writes actually happened on the tx client (proving wrapping).
      const txDelegate: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const closed = buildClosed();
      const opened = buildOpened();

      txDelegate.update.mockResolvedValue(
        prismaRowFactory({
          id: closed.id,
          classId: closed.classId,
          enrollmentDate: closed.enrollmentDate,
          endDate: closed.endDate,
          exitReason: closed.exitReason,
        }),
      );
      txDelegate.create.mockResolvedValue(
        prismaRowFactory({
          id: opened.id,
          classId: opened.classId,
          enrollmentDate: opened.enrollmentDate,
          endDate: null,
          exitReason: null,
        }),
      );

      // $transaction invokes the work callback with a tx-bound prisma client.
      prisma.$transaction.mockImplementation(async (work) =>
        work({
          enrollment: txDelegate,
          $queryRaw: jest.fn().mockResolvedValue([{ id: "parent-1" }]),
        }),
      );

      const result = await repository.transferEnrollment(closed, opened);

      // Both writes hit the tx delegate, never the outer one.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txDelegate.update).toHaveBeenCalledTimes(1);
      expect(txDelegate.create).toHaveBeenCalledTimes(1);
      expect(enrollmentDelegate.update).not.toHaveBeenCalled();
      expect(enrollmentDelegate.create).not.toHaveBeenCalled();

      // Update targets the closed row's id and carries the closing fields.
      const updateArg = txDelegate.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: closed.id });
      expect(updateArg.data.endDate).toEqual(closed.endDate);
      expect(updateArg.data.exitReason).toBe(closed.exitReason);

      // Create receives the opened entity's full create input.
      const createArg = txDelegate.create.mock.calls[0][0];
      expect(createArg.data.id).toBe(opened.id);
      expect(createArg.data.classId).toBe(opened.classId);
      expect(createArg.data.endDate).toBeNull();

      // Output mapped back to domain.
      expect(result.closed.id).toBe(closed.id);
      expect(result.closed.exitReason).toBe(ExitReason.TRANSFERRED);
      expect(result.opened.id).toBe(opened.id);
      expect(result.opened.endDate).toBeNull();
    });

    it("propagates a failure on the create op so the transaction rolls back (AC-20)", async () => {
      const txDelegate: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const closed = buildClosed();
      const opened = buildOpened();

      txDelegate.update.mockResolvedValue(prismaRowFactory({ id: closed.id }));
      // Force the second op to fail — this is what triggers the rollback in
      // real Prisma. The test asserts the error propagates out unchanged AND
      // that no writes leaked outside the $transaction wrapper.
      txDelegate.create.mockRejectedValue(
        new Error("FK violation: gradeLevel"),
      );

      prisma.$transaction.mockImplementation(async (work) =>
        work({
          enrollment: txDelegate,
          $queryRaw: jest.fn().mockResolvedValue([{ id: "parent-1" }]),
        }),
      );

      await expect(
        repository.transferEnrollment(closed, opened),
      ).rejects.toThrow("FK violation: gradeLevel");

      // Both ops attempted exactly once inside the same tx wrapper.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txDelegate.update).toHaveBeenCalledTimes(1);
      expect(txDelegate.create).toHaveBeenCalledTimes(1);
      // Crucially, no writes happened outside the tx — proving wrapping is
      // intact, which is what guarantees rollback semantics in real Prisma.
      expect(enrollmentDelegate.update).not.toHaveBeenCalled();
      expect(enrollmentDelegate.create).not.toHaveBeenCalled();
    });

    it("propagates a failure on the update op without ever calling create", async () => {
      const txDelegate: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const closed = buildClosed();
      const opened = buildOpened();

      txDelegate.update.mockRejectedValue(
        new Error("Record to update not found"),
      );

      prisma.$transaction.mockImplementation(async (work) =>
        work({
          enrollment: txDelegate,
          $queryRaw: jest.fn().mockResolvedValue([{ id: "parent-1" }]),
        }),
      );

      await expect(
        repository.transferEnrollment(closed, opened),
      ).rejects.toThrow("Record to update not found");

      expect(txDelegate.update).toHaveBeenCalledTimes(1);
      expect(txDelegate.create).not.toHaveBeenCalled();
    });
  });

  describe("mapper round-trip via findById", () => {
    it("hydrates endDate and exitReason for a closed enrollment", async () => {
      enrollmentDelegate.findUnique.mockResolvedValue(
        prismaRowFactory({
          endDate: new Date("2026-04-01T00:00:00.000Z"),
          exitReason: "GRADUATED",
        }),
      );

      const result = await repository.findById("enrollment-1");

      expect(result).not.toBeNull();
      expect(result!.endDate).toEqual(new Date("2026-04-01T00:00:00.000Z"));
      expect(result!.exitReason).toBe(ExitReason.GRADUATED);
      expect(result!.isActive()).toBe(false);
    });
  });

  describe("saveMany (atomic batch insert)", () => {
    // Build a fresh enrollment domain entity ready for persistence. The id is
    // assigned up front so the test can assert input → output ordering by id.
    const buildEnrollment = (id: string, studentId: string) =>
      Enrollment.create(
        {
          classId: "class-1",
          studentId,
          schoolYearEnrollmentId: "sye-test",
          enrollmentDate: new Date("2026-01-15T00:00:00.000Z"),
          note: null,
        },
        id,
      );

    it("persists 3 rows in a single $transaction and returns them in input order", async () => {
      // Inner tx delegate distinct from the outer enrollmentDelegate so we can
      // assert the writes actually happened on the tx client (proving wrapping).
      const txDelegate: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const inputs = [
        buildEnrollment("e-1", "student-1"),
        buildEnrollment("e-2", "student-2"),
        buildEnrollment("e-3", "student-3"),
      ];

      // Each create returns a Prisma row whose id mirrors the input — that's
      // how we verify input order is preserved end-to-end.
      txDelegate.create
        .mockResolvedValueOnce(
          prismaRowFactory({ id: "e-1", studentId: "student-1" }),
        )
        .mockResolvedValueOnce(
          prismaRowFactory({ id: "e-2", studentId: "student-2" }),
        )
        .mockResolvedValueOnce(
          prismaRowFactory({ id: "e-3", studentId: "student-3" }),
        );

      prisma.$transaction.mockImplementation(async (work) =>
        work({
          enrollment: txDelegate,
          $queryRaw: jest.fn().mockResolvedValue([{ id: "parent-1" }]),
        }),
      );

      const result = await repository.saveMany(inputs);

      // All writes routed through the tx delegate, never the outer client.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txDelegate.create).toHaveBeenCalledTimes(3);
      expect(enrollmentDelegate.create).not.toHaveBeenCalled();

      // Each create carries the include shape the response relations need.
      for (const call of txDelegate.create.mock.calls) {
        expect(call[0].include).toEqual(enrollmentInclude);
      }

      // Input order preserved in the returned array.
      expect(result).toHaveLength(3);
      expect(result.map((e) => e.id)).toEqual(["e-1", "e-2", "e-3"]);
      expect(result.map((e) => e.studentId)).toEqual([
        "student-1",
        "student-2",
        "student-3",
      ]);
    });

    it("rolls back the entire batch when a row fails mid-loop (D3)", async () => {
      const txDelegate: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const inputs = [
        buildEnrollment("e-1", "student-1"),
        buildEnrollment("e-2", "student-2"),
        buildEnrollment("e-3", "student-3"),
      ];

      // First row succeeds, second row throws. In real Prisma this triggers
      // rollback of the whole tx — the test asserts the throw propagates AND
      // that the loop stops (no third create, nothing leaks to outer client).
      txDelegate.create
        .mockResolvedValueOnce(
          prismaRowFactory({ id: "e-1", studentId: "student-1" }),
        )
        .mockRejectedValueOnce(new Error("Unique constraint failed"));

      prisma.$transaction.mockImplementation(async (work) =>
        work({
          enrollment: txDelegate,
          $queryRaw: jest.fn().mockResolvedValue([{ id: "parent-1" }]),
        }),
      );

      await expect(repository.saveMany(inputs)).rejects.toThrow(
        "Unique constraint failed",
      );

      // Exactly one tx wrapper, two attempts (success + failure), loop aborts.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txDelegate.create).toHaveBeenCalledTimes(2);
      // Crucially, no writes happened outside the tx — proving wrapping is
      // intact, which is what guarantees rollback semantics in real Prisma.
      expect(enrollmentDelegate.create).not.toHaveBeenCalled();
    });

    it("locks and revalidates parent coverage before any child insert", async () => {
      const txDelegate: EnrollmentDelegateMock = {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      };
      const queryRaw = jest.fn().mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (work) =>
        work({ enrollment: txDelegate, $queryRaw: queryRaw }),
      );

      await expect(
        repository.saveMany([buildEnrollment("e-1", "student-1")]),
      ).rejects.toThrow("NO_SCHOOL_YEAR_ENROLLMENT");

      expect(queryRaw).toHaveBeenCalledTimes(1);
      const sql = queryRaw.mock.calls[0][0];
      expect(sql.strings.join(" ")).toContain("FOR SHARE");
      expect(sql.strings.join(" ")).toContain("cancelled_at IS NULL");
      expect(txDelegate.create).not.toHaveBeenCalled();
    });
  });
});
