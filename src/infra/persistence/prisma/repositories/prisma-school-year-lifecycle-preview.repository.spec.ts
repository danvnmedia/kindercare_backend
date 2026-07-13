import { PrismaService } from "../prisma.service";
import { PrismaSchoolYearLifecycleRepository } from "./prisma-school-year-lifecycle.repository";

const now = new Date("2026-07-10T12:00:00.000Z");
const createdPreview = {
  id: "preview-new",
  lifecycleRunId: "run-1",
  runVersion: 3,
  campusId: "campus-1",
  sourceSchoolYearId: "source-year",
  targetSchoolYearId: "target-year",
  sourceClosureDate: now,
  targetEnrollmentDate: now,
  digest: "a".repeat(64),
  requestPayload: {},
  resultPayload: {},
  scopeType: "STUDENTS",
  scopeIdentity: "scope-1",
  scopePayload: {},
  status: "VALID",
  expiresAt: new Date("2026-07-11T12:00:00.000Z"),
  invalidatedAt: null,
  supersededAt: null,
  finalizedAt: null,
  createdByUserId: "user-1",
  createdAt: now,
  updatedAt: now,
};

function buildRepository(overlapping: any[]) {
  const runDelegate = {
    findFirst: jest.fn().mockResolvedValue({ id: "run-1" }),
    update: jest.fn().mockResolvedValue({ id: "run-1" }),
  };
  const previewDelegate = {
    findMany: jest.fn().mockResolvedValue(overlapping),
    updateMany: jest.fn().mockResolvedValue({ count: overlapping.length }),
    create: jest.fn().mockResolvedValue(createdPreview),
  };
  const candidateDelegate = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = {
    schoolYearLifecycleRun: runDelegate,
    schoolYearLifecyclePreviewRun: previewDelegate,
    schoolYearLifecycleCandidate: candidateDelegate,
    $transaction: jest.fn(async (callback) => callback(prisma)),
  } as any;
  return {
    prisma,
    runDelegate,
    previewDelegate,
    candidateDelegate,
    repository: new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    ),
  };
}

function input() {
  return {
    id: "preview-new",
    lifecycleRunId: "run-1",
    runVersion: 3,
    campusId: "campus-1",
    sourceSchoolYearId: "source-year",
    targetSchoolYearId: "target-year",
    sourceClosureDate: now,
    targetEnrollmentDate: now,
    digest: "a".repeat(64),
    requestPayload: {},
    resultPayload: {},
    scopeType: "STUDENTS" as const,
    scopeIdentity: "scope-1",
    scopePayload: {},
    expiresAt: new Date("2026-07-11T12:00:00.000Z"),
    createdByUserId: "user-1",
    candidates: [
      {
        candidateId: "candidate-1",
        sequence: 0,
        normalizedRow: { studentId: "student-1" },
        status: "PREVIEWED" as const,
        conflictCode: null,
        message: null,
      },
    ],
  };
}

describe("PrismaSchoolYearLifecycleRepository preview ownership", () => {
  it("allows disjoint current previews to coexist", async () => {
    const ctx = buildRepository([]);

    const result = await ctx.repository.saveRunScopedPreview(input());

    expect(result?.supersededPreviewIds).toEqual([]);
    expect(ctx.previewDelegate.updateMany).not.toHaveBeenCalled();
    expect(ctx.previewDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lifecycleRunId: "run-1",
          candidates: {
            create: [
              expect.objectContaining({
                candidateId: "candidate-1",
                sequence: 0,
              }),
            ],
          },
        }),
      }),
    );
    expect(ctx.candidateDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "candidate-1",
          committedAt: null,
          status: { not: "NO_LONGER_ELIGIBLE" },
          sourceSchoolYearEnrollment: { cancelledAt: null },
          OR: [
            { sourceEnrollmentId: null },
            { sourceEnrollment: { cancelledAt: null } },
          ],
        }),
      }),
    );
  });

  it("rolls back preview creation when a selected source was cancelled concurrently", async () => {
    const ctx = buildRepository([]);
    ctx.candidateDelegate.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      ctx.repository.saveRunScopedPreview(input()),
    ).resolves.toBeNull();
  });

  it("supersedes overlapping previews before materializing the replacement", async () => {
    const ctx = buildRepository([
      {
        id: "preview-old",
        candidates: [
          { candidateId: "candidate-1" },
          { candidateId: "candidate-old-only" },
        ],
      },
    ]);

    const result = await ctx.repository.saveRunScopedPreview(input());

    expect(result?.supersededPreviewIds).toEqual(["preview-old"]);
    expect(ctx.previewDelegate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["preview-old"] },
          campusId: "campus-1",
        },
        data: expect.objectContaining({ status: "SUPERSEDED" }),
      }),
    );
    expect(ctx.candidateDelegate.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["candidate-1", "candidate-old-only"] },
        }),
        data: { status: "READY", conflictCode: null, message: null },
      }),
    );
  });
});
