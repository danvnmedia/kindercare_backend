import { PrismaService } from "../prisma.service";
import { PrismaSchoolYearLifecycleRepository } from "./prisma-school-year-lifecycle.repository";

const now = new Date("2026-07-10T12:00:00.000Z");

describe("PrismaSchoolYearLifecycleRepository persisted commit results", () => {
  it("CAS-closes a source so a concurrent cancellation cannot be overwritten", async () => {
    const tx = {
      schoolYearEnrollment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ cancelledAt: now }),
      },
      enrollment: { updateMany: jest.fn() },
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      {} as PrismaService,
    );

    await expect(
      repository.closeSourceEnrollmentsForCommit(
        {
          id: "sye-1",
          campusId: "campus-1",
          cancelledAt: null,
          exitDate: now,
        } as any,
        null,
        tx,
      ),
    ).rejects.toThrow("LIFECYCLE_SOURCE_REGISTRATION_CANCELLED");
    expect(tx.schoolYearEnrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "sye-1",
          campusId: "campus-1",
          cancelledAt: null,
          exitDate: null,
        },
      }),
    );
  });

  it("keeps a non-cancellation source CAS miss as a failed reconciliation", async () => {
    const tx = {
      schoolYearEnrollment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ cancelledAt: null }),
      },
      enrollment: { updateMany: jest.fn() },
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      {} as PrismaService,
    );

    await expect(
      repository.closeSourceEnrollmentsForCommit(
        {
          id: "sye-1",
          campusId: "campus-1",
          cancelledAt: null,
          exitDate: now,
        } as any,
        null,
        tx,
      ),
    ).rejects.toThrow("LIFECYCLE_SOURCE_REGISTRATION_CHANGED");
  });

  it("persists a successful result and commits its candidate inside the row transaction", async () => {
    const tx = {
      schoolYearLifecycleCandidate: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      schoolYearLifecycleCommitRowResult: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      {} as PrismaService,
    );

    await repository.persistSuccessfulCommitRow(
      {
        commitAttemptId: "attempt-1",
        lifecycleRunId: "run-1",
        previewRunId: "preview-1",
        campusId: "campus-1",
        candidateId: "candidate-1",
        result: {
          studentId: "student-1",
          outcome: "PROMOTE",
          targetClassId: "class-2",
          status: "SUCCESS",
          operations: [],
          context: {
            targetSchoolYearEnrollmentId: "sye-2",
            targetClassEnrollmentId: "enrollment-2",
          },
        },
      },
      tx,
    );

    expect(tx.schoolYearLifecycleCandidate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          committedAt: null,
          status: { not: "NO_LONGER_ELIGIBLE" },
          previewMemberships: {
            some: {
              previewRunId: "preview-1",
              previewRun: { status: "COMMITTING" },
            },
          },
        }),
        data: expect.objectContaining({
          status: "COMMITTED",
          committedAt: expect.any(Date),
        }),
      }),
    );
    expect(tx.schoolYearLifecycleCommitRowResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commitAttemptId: "attempt-1",
          lifecycleCandidateId: "candidate-1",
          status: "SUCCESS",
        }),
      }),
    );
  });

  it("serializes target creation with cancellation and rejects a cancelled target", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ lockAcquired: 1 }]),
      schoolYearEnrollment: {
        findFirst: jest.fn().mockResolvedValue({ cancelledAt: now }),
      },
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      {} as PrismaService,
    );

    await expect(
      repository.assertTargetRegistrationCanBeCreated(
        "student-1",
        "target-year",
        tx,
      ),
    ).rejects.toThrow("CANCELLED_TARGET_REGISTRATION");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.schoolYearEnrollment.findFirst).toHaveBeenCalledWith({
      where: { studentId: "student-1", schoolYearId: "target-year" },
      select: { cancelledAt: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("does not create an attempt when the preview lock is stale", async () => {
    const previewDelegate = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const attemptDelegate = { create: jest.fn() };
    const prisma = {
      schoolYearLifecyclePreviewRun: previewDelegate,
      schoolYearLifecycleCommitAttempt: attemptDelegate,
      $transaction: jest.fn(async (callback) => callback(prisma)),
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    await expect(
      repository.startCommitAttempt({
        lifecycleRunId: "run-1",
        previewRunId: "preview-1",
        runVersion: 3,
        campusId: "campus-1",
        createdByUserId: "user-1",
      }),
    ).resolves.toBeNull();
    expect(previewDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          candidates: {
            every: {
              candidate: expect.objectContaining({
                committedAt: null,
                status: { not: "NO_LONGER_ELIGIBLE" },
                sourceSchoolYearEnrollment: { cancelledAt: null },
              }),
            },
          },
        }),
      }),
    );
    expect(attemptDelegate.create).not.toHaveBeenCalled();
  });

  it("persists immutable row results and marks a partially completed run", async () => {
    const attemptDelegate = {
      findFirst: jest.fn().mockResolvedValue({ id: "attempt-1" }),
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: "attempt-1",
        lifecycleRunId: "run-1",
        previewRunId: "preview-1",
        campusId: "campus-1",
        status: "PARTIAL",
        successCount: 1,
        failedCount: 1,
        skippedCount: 0,
        alreadyAppliedCount: 0,
        createdByUserId: "user-1",
        startedAt: now,
        completedAt: now,
        createdAt: now,
        rowResults: [
          {
            id: "result-1",
            lifecycleCandidateId: "candidate-1",
            studentId: "student-1",
            status: "SUCCESS",
            outcome: "PROMOTE",
            targetClassId: "class-2",
            conflictCode: null,
            message: null,
            resultingSchoolYearEnrollmentId: "sye-2",
            resultingClassEnrollmentId: "enrollment-2",
            operations: [],
            context: {},
            createdAt: now,
          },
        ],
      }),
    };
    const rowResultDelegate = {
      createMany: jest.fn().mockResolvedValue({ count: 2 }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    };
    const candidateDelegate = {
      findMany: jest.fn().mockResolvedValue([
        { id: "candidate-1", status: "COMMITTED", committedAt: now },
        { id: "candidate-2", status: "FAILED", committedAt: null },
      ]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      groupBy: jest.fn().mockResolvedValue([
        { status: "COMMITTED", _count: { _all: 1 } },
        { status: "FAILED", _count: { _all: 1 } },
      ]),
    };
    const previewDelegate = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const runDelegate = {
      findFirstOrThrow: jest.fn().mockResolvedValue({
        firstCommittedAt: null,
      }),
      update: jest.fn().mockResolvedValue({
        id: "run-1",
        campusId: "campus-1",
        sourceSchoolYearId: "source-year",
        targetSchoolYearId: "target-year",
        sourceClosureDate: now,
        targetEnrollmentDate: now,
        status: "PARTIALLY_COMMITTED",
        version: 4,
        createdByUserId: "user-1",
        updatedByUserId: null,
        firstCommittedAt: now,
        completedAt: null,
        cancelledAt: null,
        expiredAt: null,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    };
    const prisma = {
      schoolYearLifecycleCommitAttempt: attemptDelegate,
      schoolYearLifecycleCommitRowResult: rowResultDelegate,
      schoolYearLifecycleCandidate: candidateDelegate,
      schoolYearLifecyclePreviewRun: previewDelegate,
      schoolYearLifecycleRun: runDelegate,
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback) => callback(prisma)),
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    const result = await repository.finalizeCommitAttempt({
      commitAttemptId: "attempt-1",
      lifecycleRunId: "run-1",
      previewRunId: "preview-1",
      campusId: "campus-1",
      rows: [
        {
          candidateId: "candidate-1",
          result: {
            studentId: "student-1",
            outcome: "PROMOTE",
            targetClassId: "class-2",
            status: "SUCCESS",
            operations: [],
            context: {
              targetSchoolYearEnrollmentId: "sye-2",
              targetClassEnrollmentId: "enrollment-2",
            },
          },
        },
        {
          candidateId: "candidate-2",
          result: {
            studentId: "student-2",
            outcome: "PROMOTE",
            targetClassId: "class-2",
            status: "FAILED",
            conflictCode: "EXISTING_TARGET_REGISTRATION",
            message: "conflict",
            operations: [],
            context: {},
          },
        },
      ],
    });

    expect(rowResultDelegate.createMany).toHaveBeenCalledTimes(1);
    expect(candidateDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "NO_LONGER_ELIGIBLE" },
        }),
      }),
    );
    expect(attemptDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PARTIAL",
          successCount: 1,
          failedCount: 1,
        }),
      }),
    );
    expect(runDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PARTIALLY_COMMITTED",
          version: { increment: 1 },
          firstCommittedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.run.status).toBe("PARTIALLY_COMMITTED");
  });

  it("finalizes durable successes while excluding a candidate cancelled mid-batch", async () => {
    const attempt = {
      findFirst: jest.fn().mockResolvedValue({ id: "attempt-1" }),
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: "attempt-1",
        lifecycleRunId: "run-1",
        previewRunId: "preview-1",
        campusId: "campus-1",
        status: "COMPLETED",
        successCount: 1,
        failedCount: 0,
        skippedCount: 0,
        alreadyAppliedCount: 0,
        createdByUserId: "user-1",
        startedAt: now,
        completedAt: now,
        createdAt: now,
        rowResults: [],
      }),
    };
    const rowResults = {
      findMany: jest
        .fn()
        .mockResolvedValue([{ lifecycleCandidateId: "candidate-1" }]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const candidates = {
      findMany: jest.fn().mockResolvedValue([
        { id: "candidate-1", status: "COMMITTED", committedAt: now },
        {
          id: "candidate-2",
          status: "NO_LONGER_ELIGIBLE",
          committedAt: null,
        },
      ]),
      updateMany: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([
        { status: "COMMITTED", _count: { _all: 1 } },
        { status: "NO_LONGER_ELIGIBLE", _count: { _all: 1 } },
      ]),
    };
    const runRow = {
      id: "run-1",
      campusId: "campus-1",
      sourceSchoolYearId: "source-year",
      targetSchoolYearId: "target-year",
      sourceClosureDate: now,
      targetEnrollmentDate: now,
      status: "COMPLETED",
      version: 4,
      createdByUserId: "user-1",
      updatedByUserId: null,
      firstCommittedAt: now,
      completedAt: now,
      cancelledAt: null,
      expiredAt: null,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const runs = {
      findFirstOrThrow: jest.fn().mockResolvedValue(runRow),
      update: jest.fn().mockResolvedValue(runRow),
    };
    const prisma = {
      schoolYearLifecycleCommitAttempt: attempt,
      schoolYearLifecycleCommitRowResult: rowResults,
      schoolYearLifecycleCandidate: candidates,
      schoolYearLifecyclePreviewRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      schoolYearLifecycleRun: runs,
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback) => callback(prisma)),
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    await repository.finalizeCommitAttempt({
      commitAttemptId: "attempt-1",
      lifecycleRunId: "run-1",
      previewRunId: "preview-1",
      campusId: "campus-1",
      rows: [
        {
          candidateId: "candidate-1",
          result: successfulResult("student-1"),
        },
        {
          candidateId: "candidate-2",
          result: {
            ...successfulResult("student-2"),
            status: "SKIPPED",
            message: "SOURCE_REGISTRATION_CANCELLED",
          },
        },
      ],
    });

    expect(candidates.updateMany).not.toHaveBeenCalled();
    expect(rowResults.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          lifecycleCandidateId: "candidate-2",
          status: "SKIPPED",
          message: "SOURCE_REGISTRATION_CANCELLED",
        }),
      ],
    });
    expect(attempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          successCount: 1,
          failedCount: 0,
          skippedCount: 1,
        }),
      }),
    );
    expect(runs.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });

  it("recovers durable row successes instead of resetting their preview to VALID", async () => {
    const attempts = {
      findFirst: jest.fn().mockResolvedValue({
        lifecycleRunId: "run-1",
        rowResults: [{ status: "SUCCESS" }],
      }),
      update: jest.fn().mockResolvedValue({}),
    };
    const previews = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const runs = {
      findFirstOrThrow: jest.fn().mockResolvedValue({ firstCommittedAt: null }),
      update: jest.fn().mockResolvedValue({}),
    };
    const prisma = {
      schoolYearLifecycleCommitAttempt: attempts,
      schoolYearLifecyclePreviewRun: previews,
      schoolYearLifecycleCandidate: {
        groupBy: jest.fn().mockResolvedValue([
          { status: "COMMITTED", _count: { _all: 1 } },
          { status: "READY", _count: { _all: 1 } },
        ]),
      },
      schoolYearLifecycleRun: runs,
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback) => callback(prisma)),
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    await repository.failCommitAttempt("attempt-1", "preview-1", "campus-1");

    expect(attempts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PARTIAL",
          successCount: 1,
        }),
      }),
    );
    expect(previews.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FINALIZED" }),
      }),
    );
    expect(runs.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PARTIALLY_COMMITTED" }),
      }),
    );
  });
});

function successfulResult(studentId: string) {
  return {
    studentId,
    outcome: "PROMOTE" as const,
    targetClassId: "class-2",
    status: "SUCCESS" as const,
    operations: [],
    context: {
      targetSchoolYearEnrollmentId: `sye-${studentId}`,
      targetClassEnrollmentId: `enrollment-${studentId}`,
    },
  };
}
