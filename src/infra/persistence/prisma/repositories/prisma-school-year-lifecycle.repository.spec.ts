import { readFileSync } from "fs";
import { resolve } from "path";

import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma.service";
import { PrismaSchoolYearLifecycleRepository } from "./prisma-school-year-lifecycle.repository";

const now = new Date("2026-07-10T12:00:00.000Z");
const runRow = {
  id: "run-1",
  campusId: "campus-1",
  sourceSchoolYearId: "source-year",
  targetSchoolYearId: "target-year",
  sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
  targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
  status: "DRAFT",
  version: 1,
  createdByUserId: "user-1",
  updatedByUserId: null,
  firstCommittedAt: null,
  completedAt: null,
  cancelledAt: null,
  expiredAt: null,
  retentionExpiresAt: null,
  retentionPolicySource: null,
  legalHold: false,
  lastActivityAt: now,
  createdAt: now,
  updatedAt: now,
};

describe("PrismaSchoolYearLifecycleRepository run persistence", () => {
  let runDelegate: {
    findFirst: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
    findMany: jest.Mock;
  };
  let prisma: {
    schoolYearLifecycleRun: typeof runDelegate;
    $transaction: jest.Mock;
  };
  let repository: PrismaSchoolYearLifecycleRepository;

  beforeEach(() => {
    runDelegate = {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    };
    prisma = {
      schoolYearLifecycleRun: runDelegate,
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    repository = new PrismaSchoolYearLifecycleRepository(
      prisma as unknown as PrismaService,
    );
  });

  it("scopes active-run lookup by campus and active statuses", async () => {
    runDelegate.findFirst.mockResolvedValue(runRow);

    const result = await repository.findActiveRun("campus-1", "source-year");

    expect(runDelegate.findFirst).toHaveBeenCalledWith({
      where: {
        campusId: "campus-1",
        sourceSchoolYearId: "source-year",
        status: {
          in: [
            "SETUP_INCOMPLETE",
            "DRAFT",
            "IN_PROGRESS",
            "PARTIALLY_COMMITTED",
            "NEEDS_RECONCILIATION",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toMatchObject({ id: "run-1", status: "DRAFT" });
  });

  it("returns the competing active run after the partial unique index wins a race", async () => {
    runDelegate.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(runRow);
    runDelegate.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate active run", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    const result = await repository.findOrCreateRun({
      campusId: "campus-1",
      sourceSchoolYearId: "source-year",
      targetSchoolYearId: "target-year",
      sourceClosureDate: runRow.sourceClosureDate,
      targetEnrollmentDate: runRow.targetEnrollmentDate,
      createdByUserId: "user-1",
    });

    expect(result).toEqual({
      run: expect.objectContaining({ id: "run-1" }),
      created: false,
    });
  });

  it("records run creation audit on the same transaction client", async () => {
    runDelegate.findFirst.mockResolvedValue(null);
    runDelegate.create.mockResolvedValue(runRow);
    const recorder = { record: jest.fn().mockResolvedValue(undefined) };
    repository = new PrismaSchoolYearLifecycleRepository(
      prisma as unknown as PrismaService,
      recorder as any,
    );
    const audit = {
      actorId: "user-1",
      action: "CREATE_SCHOOL_YEAR_LIFECYCLE_RUN" as const,
      targetType: "school_year" as const,
      targetId: "source-year",
      campusId: "campus-1",
      context: { lifecycleRunId: "run-1" },
    };

    await repository.findOrCreateRun({
      id: "run-1",
      campusId: "campus-1",
      sourceSchoolYearId: "source-year",
      targetSchoolYearId: "target-year",
      sourceClosureDate: runRow.sourceClosureDate,
      targetEnrollmentDate: runRow.targetEnrollmentDate,
      createdByUserId: "user-1",
      audit,
    });

    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        ...audit,
        context: expect.objectContaining({
          lifecycleRunId: "run-1",
          candidateCount: 0,
        }),
      }),
      prisma,
    );
  });

  it("uses one compare-and-swap transaction and returns null for a stale version", async () => {
    runDelegate.updateMany.mockResolvedValue({ count: 0 });

    const result = await repository.updateRunVersioned({
      id: "run-1",
      campusId: "campus-1",
      expectedVersion: 7,
      updatedByUserId: "user-2",
      sourceClosureDate: new Date("2026-06-29T00:00:00.000Z"),
    });

    expect(result).toBeNull();
    expect(runDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1", campusId: "campus-1", version: 7 },
        data: expect.objectContaining({
          sourceClosureDate: new Date("2026-06-29T00:00:00.000Z"),
          updatedByUserId: "user-2",
          version: { increment: 1 },
        }),
      }),
    );
    expect(runDelegate.findFirst).not.toHaveBeenCalled();
  });

  it("discovers only never-committed inactive statuses and excludes active commits", async () => {
    runDelegate.findMany.mockResolvedValue([]);
    const inactiveBefore = new Date("2026-04-11T12:00:00.000Z");

    await repository.findInactiveUncommittedRuns(inactiveBefore, 200);

    expect(runDelegate.findMany).toHaveBeenCalledWith({
      where: {
        firstCommittedAt: null,
        status: { in: ["SETUP_INCOMPLETE", "DRAFT", "IN_PROGRESS"] },
        lastActivityAt: { lte: inactiveBefore },
        previewRuns: { none: { status: "COMMITTING" } },
      },
      orderBy: [{ lastActivityAt: "asc" }, { id: "asc" }],
      take: 200,
    });
  });

  it("keeps schema and migration active-run constraints aligned", () => {
    const schema = readFileSync(
      resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260710160000_add_school_year_lifecycle_run_workflow/migration.sql",
      ),
      "utf8",
    );

    expect(schema).toContain("model SchoolYearLifecycleRun");
    expect(schema).toContain("model SchoolYearLifecycleCommitRowResult");
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "school_year_lifecycle_run_one_active_source_key"',
    );
    expect(migration).toContain(
      "WHERE \"status\" IN ('SETUP_INCOMPLETE', 'DRAFT', 'IN_PROGRESS', 'PARTIALLY_COMMITTED', 'NEEDS_RECONCILIATION')",
    );
  });
});

describe("PrismaSchoolYearLifecycleRepository target registration discovery", () => {
  it("discovers only uncancelled effective source parents and child placements", async () => {
    const schoolYearEnrollment = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const repository = new PrismaSchoolYearLifecycleRepository({
      schoolYearEnrollment,
    } as unknown as PrismaService);
    const effectiveDate = new Date("2026-06-30T00:00:00.000Z");

    await repository.findOpenSourceCandidates(
      "campus-1",
      "source-year",
      ["student-1"],
      effectiveDate,
    );

    expect(schoolYearEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campusId: "campus-1",
          schoolYearId: "source-year",
          studentId: { in: ["student-1"] },
          cancelledAt: null,
          enrollmentDate: { lte: effectiveDate },
        }),
        include: expect.objectContaining({
          enrollments: expect.objectContaining({
            where: expect.objectContaining({
              cancelledAt: null,
              enrollmentDate: { lte: effectiveDate },
            }),
          }),
        }),
      }),
    );
  });

  it("finds every structurally open uncancelled target parent regardless of future start", async () => {
    const schoolYearEnrollment = {
      findMany: jest.fn().mockResolvedValue([{ studentId: "student-1" }]),
    };
    const repository = new PrismaSchoolYearLifecycleRepository({
      schoolYearEnrollment,
    } as unknown as PrismaService);

    const result = await repository.findOpenTargetRegistrationStudentIds(
      "campus-1",
      "target-year",
      ["student-1"],
    );

    expect(schoolYearEnrollment.findMany).toHaveBeenCalledWith({
      where: {
        campusId: "campus-1",
        schoolYearId: "target-year",
        studentId: { in: ["student-1"] },
        cancelledAt: null,
        exitDate: null,
      },
      select: { studentId: true },
      orderBy: { studentId: "asc" },
    });
    expect(result).toEqual(["student-1"]);
  });

  it("finds cancelled target parents so Lifecycle cannot recreate them", async () => {
    const schoolYearEnrollment = {
      findMany: jest.fn().mockResolvedValue([{ studentId: "student-1" }]),
    };
    const repository = new PrismaSchoolYearLifecycleRepository({
      schoolYearEnrollment,
    } as unknown as PrismaService);

    const result = await repository.findCancelledTargetRegistrationStudentIds(
      "campus-1",
      "target-year",
      ["student-1"],
    );

    expect(schoolYearEnrollment.findMany).toHaveBeenCalledWith({
      where: {
        campusId: "campus-1",
        schoolYearId: "target-year",
        studentId: { in: ["student-1"] },
        cancelledAt: { not: null },
      },
      select: { studentId: true },
      distinct: ["studentId"],
      orderBy: { studentId: "asc" },
    });
    expect(result).toEqual(["student-1"]);
  });
});
