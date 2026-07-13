import { PrismaService } from "../prisma.service";
import { PrismaSchoolYearLifecycleRepository } from "./prisma-school-year-lifecycle.repository";

describe("PrismaSchoolYearLifecycleRepository candidate projections", () => {
  it("applies bounded filters, search, and a stable ordering tie-breaker", async () => {
    const candidateDelegate = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: "candidate-1",
          lifecycleRunId: "run-1",
          campusId: "campus-1",
          studentId: "student-1",
          sourceSchoolYearEnrollmentId: "sye-1",
          sourceEnrollmentId: null,
          sourceGradeLevelId: "grade-1",
          sourceClassId: null,
          status: "NOT_STARTED",
          recommendedOutcome: "PROMOTE",
          decision: null,
          targetGradeLevelId: "grade-2",
          targetClassId: null,
          decisionNote: null,
          decisionUpdatedByUserId: null,
          decisionUpdatedAt: null,
          rowVersion: 1,
          committedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          student: { studentCode: "S001", fullName: "Ada Student" },
          sourceSchoolYearEnrollment: {
            snapshotStudentCode: null,
            snapshotStudentFullName: null,
          },
          sourceGradeLevel: { name: "Grade 1", order: 1 },
          sourceClass: null,
          targetClass: null,
        },
      ]),
      count: jest.fn().mockResolvedValue(1),
      groupBy: jest.fn(),
    };
    const prisma = {
      schoolYearLifecycleCandidate: candidateDelegate,
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    const page = await repository.findCandidatePage("run-1", "campus-1", {
      offset: 0,
      limit: 50,
      search: "Ada",
      sourceGradeLevelId: "grade-1",
      sourceClassId: null,
      status: "NOT_STARTED",
      sortBy: "studentName",
      sortOrder: "asc",
    });

    expect(candidateDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
        where: expect.objectContaining({
          lifecycleRunId: "run-1",
          campusId: "campus-1",
          sourceClassId: null,
          status: "NOT_STARTED",
          OR: expect.any(Array),
        }),
        orderBy: [{ student: { fullName: "asc" } }, { studentId: "asc" }],
      }),
    );
    expect(page.data[0]).toMatchObject({
      studentCode: "S001",
      studentName: "Ada Student",
      sourceClassId: null,
      rowVersion: 1,
    });
    expect(page.pagination).toMatchObject({ count: 1, hasNext: false });
  });

  it("uses aggregate plus batched grade/class display queries for progress", async () => {
    const candidateDelegate = {
      groupBy: jest.fn().mockResolvedValue([
        {
          sourceGradeLevelId: "grade-1",
          sourceClassId: "class-1",
          status: "READY",
          decision: "PROMOTE",
          targetClassId: "target-class",
          _count: { _all: 12 },
        },
      ]),
    };
    const prisma = {
      schoolYearLifecycleCandidate: candidateDelegate,
      gradeLevel: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: "grade-1", name: "Grade 1", order: 1 }]),
      },
      class: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: "class-1", name: "Class A" }]),
      },
    } as any;
    const repository = new PrismaSchoolYearLifecycleRepository(
      prisma as PrismaService,
    );

    const result = await repository.findCandidateAggregates(
      "run-1",
      "campus-1",
    );

    expect(candidateDelegate.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.gradeLevel.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.class.findMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      expect.objectContaining({
        sourceGradeLevelName: "Grade 1",
        sourceClassName: "Class A",
        count: 12,
      }),
    ]);
  });
});
