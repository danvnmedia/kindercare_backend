import { PrismaService } from "../prisma.service";
import { PrismaSchoolYearLifecycleRepository } from "./prisma-school-year-lifecycle.repository";

describe("PrismaSchoolYearLifecycleRepository decision concurrency", () => {
  it("applies no candidate or preview writes when expectedVersion is stale", async () => {
    const runDelegate = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn(),
    };
    const candidateDelegate = { updateMany: jest.fn() };
    const previewDelegate = { updateMany: jest.fn(), findMany: jest.fn() };
    const prisma = {
      schoolYearLifecycleRun: runDelegate,
      schoolYearLifecycleCandidate: candidateDelegate,
      schoolYearLifecyclePreviewRun: previewDelegate,
      $transaction: jest.fn(async (callback) => callback(prisma)),
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    const result = await repository.saveDecisionsVersioned({
      lifecycleRunId: "run-1",
      campusId: "campus-1",
      expectedVersion: 4,
      updatedByUserId: "user-1",
      decisions: [
        {
          candidateId: "candidate-1",
          decision: "SKIP",
          targetGradeLevelId: null,
          targetClassId: null,
          decisionNote: null,
          status: "READY",
        },
      ],
    });

    expect(result).toBeNull();
    expect(candidateDelegate.updateMany).not.toHaveBeenCalled();
    expect(previewDelegate.updateMany).not.toHaveBeenCalled();
    expect(runDelegate.findFirst).not.toHaveBeenCalled();
  });

  it("increments the run once and invalidates only previews containing accepted rows", async () => {
    const now = new Date();
    const runDelegate = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({
        id: "run-1",
        campusId: "campus-1",
        sourceSchoolYearId: "source-year",
        targetSchoolYearId: "target-year",
        sourceClosureDate: now,
        targetEnrollmentDate: now,
        status: "DRAFT",
        version: 5,
        createdByUserId: "user-1",
        updatedByUserId: "user-1",
        firstCommittedAt: null,
        completedAt: null,
        cancelledAt: null,
        expiredAt: null,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    };
    const candidateDelegate = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const previewDelegate = {
      findMany: jest.fn().mockResolvedValue([{ id: "preview-1" }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const prisma = {
      schoolYearLifecycleRun: runDelegate,
      schoolYearLifecycleCandidate: candidateDelegate,
      schoolYearLifecyclePreviewRun: previewDelegate,
      $transaction: jest.fn(async (callback) => callback(prisma)),
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    const result = await repository.saveDecisionsVersioned({
      lifecycleRunId: "run-1",
      campusId: "campus-1",
      expectedVersion: 4,
      updatedByUserId: "user-1",
      decisions: [
        {
          candidateId: "candidate-1",
          decision: "SKIP",
          targetGradeLevelId: null,
          targetClassId: null,
          decisionNote: null,
          status: "READY",
        },
        {
          candidateId: "candidate-2",
          decision: "GRADUATE",
          targetGradeLevelId: null,
          targetClassId: null,
          decisionNote: null,
          status: "READY",
        },
      ],
    });

    expect(runDelegate.updateMany).toHaveBeenCalledTimes(1);
    expect(runDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ version: 4 }),
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
    expect(candidateDelegate.updateMany).toHaveBeenCalledTimes(2);
    expect(previewDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          candidates: {
            some: {
              candidateId: { in: ["candidate-1", "candidate-2"] },
            },
          },
        }),
      }),
    );
    expect(result?.version).toBe(5);
  });
});
