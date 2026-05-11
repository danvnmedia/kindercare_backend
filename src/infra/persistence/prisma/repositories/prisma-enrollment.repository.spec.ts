import { PrismaEnrollmentRepository } from "./prisma-enrollment.repository";
import { PrismaService } from "../prisma.service";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";

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

  // A canonical Prisma row used to assert mapping behavior. Includes the
  // class/student relations that the repository queries always request via
  // `include`, so the mapper can hydrate the domain entity.
  const prismaRowFactory = (overrides: Record<string, unknown> = {}) => ({
    id: "enrollment-1",
    classId: "class-1",
    studentId: "student-1",
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
        where: { studentId: "student-1", endDate: null },
        include: { class: true, student: true },
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

  describe("findActiveByClassId", () => {
    it("queries with endDate=null and orders by enrollmentDate desc", async () => {
      enrollmentDelegate.findMany.mockResolvedValue([
        prismaRowFactory({ id: "e-1" }),
        prismaRowFactory({ id: "e-2", studentId: "student-2" }),
      ]);

      const result = await repository.findActiveByClassId("class-1");

      expect(enrollmentDelegate.findMany).toHaveBeenCalledWith({
        where: { classId: "class-1", endDate: null },
        include: { class: true, student: true },
        orderBy: { enrollmentDate: "desc" },
      });
      expect(result).toHaveLength(2);
      expect(result.every((e) => e.isActive())).toBe(true);
    });

    it("returns an empty array when no active enrollments exist", async () => {
      enrollmentDelegate.findMany.mockResolvedValue([]);

      const result = await repository.findActiveByClassId("class-1");

      expect(result).toEqual([]);
    });
  });

  describe("findHistoricalByClassId", () => {
    it("queries WITHOUT endDate filter and returns active and closed rows together", async () => {
      enrollmentDelegate.findMany.mockResolvedValue([
        prismaRowFactory({ id: "e-active" }),
        prismaRowFactory({
          id: "e-closed",
          studentId: "student-2",
          endDate: new Date("2026-03-01T00:00:00.000Z"),
          exitReason: "WITHDRAWN",
        }),
      ]);

      const result = await repository.findHistoricalByClassId("class-1");

      expect(enrollmentDelegate.findMany).toHaveBeenCalledWith({
        where: { classId: "class-1" },
        include: { class: true, student: true },
        orderBy: { enrollmentDate: "desc" },
      });
      // Confirm the mapper hydrates the closed row's exitReason as the enum.
      expect(result).toHaveLength(2);
      const closed = result.find((e) => !e.isActive())!;
      expect(closed.endDate).toEqual(new Date("2026-03-01T00:00:00.000Z"));
      expect(closed.exitReason).toBe(ExitReason.WITHDRAWN);
    });

    it("does not pass an endDate condition (sanity check on filter shape)", async () => {
      enrollmentDelegate.findMany.mockResolvedValue([]);

      await repository.findHistoricalByClassId("class-1");

      const call = enrollmentDelegate.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty("endDate");
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
        work({ enrollment: txDelegate }),
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

      txDelegate.update.mockResolvedValue(
        prismaRowFactory({ id: closed.id }),
      );
      // Force the second op to fail — this is what triggers the rollback in
      // real Prisma. The test asserts the error propagates out unchanged AND
      // that no writes leaked outside the $transaction wrapper.
      txDelegate.create.mockRejectedValue(new Error("FK violation: gradeLevel"));

      prisma.$transaction.mockImplementation(async (work) =>
        work({ enrollment: txDelegate }),
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
        work({ enrollment: txDelegate }),
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
        work({ enrollment: txDelegate }),
      );

      const result = await repository.saveMany(inputs);

      // All writes routed through the tx delegate, never the outer client.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txDelegate.create).toHaveBeenCalledTimes(3);
      expect(enrollmentDelegate.create).not.toHaveBeenCalled();

      // Each create carries the include shape the response relations need.
      for (const call of txDelegate.create.mock.calls) {
        expect(call[0].include).toEqual({ class: true, student: true });
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
        work({ enrollment: txDelegate }),
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
  });
});
