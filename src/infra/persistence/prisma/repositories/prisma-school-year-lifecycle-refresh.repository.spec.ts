import { PrismaService } from "../prisma.service";
import { PrismaSchoolYearLifecycleRepository } from "./prisma-school-year-lifecycle.repository";

describe("PrismaSchoolYearLifecycleRepository refresh eligibility", () => {
  it("rolls back a refresh insert when cancellation wins before source locking", async () => {
    const prisma = buildPrisma([]);
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    await expect(
      repository.reconcileCandidatesVersioned({
        lifecycleRunId: "run-1",
        campusId: "campus-1",
        expectedVersion: 1,
        updatedByUserId: "user-1",
        inserts: [source("candidate-new")],
        updates: [],
      }),
    ).resolves.toBeNull();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(
      prisma.schoolYearLifecycleCandidate.createMany,
    ).not.toHaveBeenCalled();
  });

  it("rolls back a stale refresh update instead of resurrecting NO_LONGER_ELIGIBLE", async () => {
    const prisma = buildPrisma([{ id: "sye-1" }]);
    prisma.schoolYearLifecycleCandidate.updateMany.mockResolvedValue({
      count: 0,
    });
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    await expect(
      repository.reconcileCandidatesVersioned({
        lifecycleRunId: "run-1",
        campusId: "campus-1",
        expectedVersion: 1,
        updatedByUserId: "user-1",
        inserts: [],
        updates: [source("candidate-1")],
      }),
    ).resolves.toBeNull();
    expect(prisma.schoolYearLifecycleCandidate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "NO_LONGER_ELIGIBLE" },
          sourceSchoolYearEnrollment: { cancelledAt: null },
        }),
      }),
    );
  });
});

function source(id: string) {
  return {
    id,
    lifecycleRunId: "run-1",
    campusId: "campus-1",
    studentId: "student-1",
    sourceSchoolYearEnrollmentId: "sye-1",
    sourceEnrollmentId: null,
    sourceGradeLevelId: "grade-1",
    sourceClassId: null,
    recommendedOutcome: "PROMOTE" as const,
    status: "READY" as const,
    decision: "PROMOTE" as const,
    targetGradeLevelId: "grade-2",
    targetClassId: null,
  };
}

function buildPrisma(lockedParents: Array<{ id: string }>) {
  const prisma = {
    schoolYearLifecycleRun: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    schoolYearLifecycleCandidate: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: jest.fn().mockResolvedValue(lockedParents),
    $transaction: jest.fn(async (callback) => callback(prisma)),
  } as any;
  return prisma;
}
