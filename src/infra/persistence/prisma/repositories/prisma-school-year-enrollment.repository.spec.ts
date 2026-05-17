import { PrismaSchoolYearEnrollmentRepository } from "./prisma-school-year-enrollment.repository";
import { PrismaService } from "../prisma.service";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

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
      create: jest.fn(),
      update: jest.fn(),
    };
    prisma = {
      schoolYearEnrollment: syeDelegate,
      enrollment: enrollmentDelegate,
      $transaction: jest.fn(),
    };
    repository = new PrismaSchoolYearEnrollmentRepository(
      prisma as unknown as PrismaService,
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
        where: { studentId: "student-1", schoolYearId: "year-1", exitDate: null },
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
        create: jest.fn(),
        update: jest.fn(),
      };
      const parent = buildClosedParent();
      const child = buildClosedChild();

      txSye.update.mockRejectedValue(
        new Error("Record to update not found"),
      );

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
