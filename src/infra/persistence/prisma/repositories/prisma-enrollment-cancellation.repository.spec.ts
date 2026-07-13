import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";

import { PrismaEnrollmentMapper } from "../mapper/prisma-enrollment.mapper";
import { PrismaSchoolYearEnrollmentMapper } from "../mapper/prisma-school-year-enrollment.mapper";
import { PrismaService } from "../prisma.service";
import { PrismaEnrollmentCancellationRepository } from "./prisma-enrollment-cancellation.repository";

describe("PrismaEnrollmentCancellationRepository", () => {
  const referenceDate = new Date("2026-07-11T18:00:00.000Z");
  const cancelledAt = new Date("2026-07-11T12:00:00.000Z");
  const parent = SchoolYearEnrollment.create(
    {
      studentId: "student-1",
      campusId: "campus-1",
      schoolYearId: "year-1",
      gradeLevelId: "grade-1",
      enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    },
    "parent-1",
  ).cancel({
    cancelledAt,
    reason: EnrollmentCancellationReason.FAMILY_REQUEST,
    note: "family moved",
    actorId: "actor-1",
    actorFullName: "Alice Admin",
  });
  const child = Enrollment.create(
    {
      classId: "class-1",
      studentId: "student-1",
      schoolYearEnrollmentId: "parent-1",
      enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    },
    "child-1",
  ).cancel({
    cancelledAt,
    reason: EnrollmentCancellationReason.FAMILY_REQUEST,
    note: "family moved",
    actorId: "actor-1",
    actorFullName: "Alice Admin",
  });

  let tx: any;
  let repository: PrismaEnrollmentCancellationRepository;

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ lockAcquired: 1 }]),
      schoolYearEnrollment: {
        findUnique: jest.fn(),
      },
      enrollment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      schoolYearLifecycleCandidate: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest
          .fn()
          .mockResolvedValue([{ status: "READY", _count: { _all: 1 } }]),
      },
      schoolYearLifecyclePreviewRun: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      schoolYearLifecycleRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    repository = new PrismaEnrollmentCancellationRepository(
      tx as unknown as PrismaService,
    );
  });

  it("conditionally cancels only an uncancelled parent starting after the UTC date", async () => {
    tx.$executeRaw.mockResolvedValue(1);
    tx.schoolYearEnrollment.findUnique.mockResolvedValue(parentRow());

    const result = await repository.cancelParentIfUpcoming(
      parent,
      referenceDate,
      tx,
    );

    const sql = tx.$executeRaw.mock.calls[0][0];
    expect(sql.strings.join(" ")).toContain(
      "enrollment_date > (clock_timestamp() AT TIME ZONE 'UTC')::date",
    );
    expect(sql.strings.join(" ")).toContain("exit_date IS NULL");
    expect(sql.values).toEqual(
      expect.arrayContaining([
        parent.cancelledAt,
        parent.cancellationReason,
        parent.id,
        parent.campusId,
      ]),
    );
    expect(result?.cancelledAt).toEqual(cancelledAt);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result?.cancellationReason).toBe(
      EnrollmentCancellationReason.FAMILY_REQUEST,
    );
  });

  it("returns null without a follow-up read when the parent CAS misses", async () => {
    tx.$executeRaw.mockResolvedValue(0);

    await expect(
      repository.cancelParentIfUpcoming(parent, referenceDate, tx),
    ).resolves.toBeNull();
    expect(tx.schoolYearEnrollment.findUnique).not.toHaveBeenCalled();
  });

  it("resolves children only through schoolYearEnrollmentId", async () => {
    tx.enrollment.findMany.mockResolvedValue([childRow()]);

    const result = await repository.findChildrenByParentId("parent-1", tx);

    expect(tx.enrollment.findMany).toHaveBeenCalledWith({
      where: { schoolYearEnrollmentId: "parent-1" },
      include: {
        class: { include: { schoolYear: true, gradeLevel: true } },
        student: true,
      },
      orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
    });
    expect(result.map((row) => row.id)).toEqual(["child-1"]);
  });

  it("updates every selected child on the caller transaction", async () => {
    tx.$executeRaw.mockResolvedValue(1);
    tx.enrollment.findUnique.mockResolvedValue(childRow());

    const result = await repository.cancelChildrenIfUpcoming(
      [child],
      referenceDate,
      tx,
    );

    const sql = tx.$executeRaw.mock.calls[0][0];
    expect(sql.strings.join(" ")).toContain(
      "enrollment_date > (clock_timestamp() AT TIME ZONE 'UTC')::date",
    );
    expect(sql.values).toEqual(
      expect.arrayContaining([
        child.cancelledAt,
        child.cancellationReason,
        child.id,
      ]),
    );
    expect(result![0].cancellationReason).toBe(
      EnrollmentCancellationReason.FAMILY_REQUEST,
    );
  });

  it("returns null on a child CAS miss so the caller can roll back the parent", async () => {
    tx.$executeRaw.mockResolvedValue(0);

    const result = await repository.cancelChildrenIfUpcoming(
      [child],
      referenceDate,
      tx,
    );

    expect(result).toBeNull();
    expect(tx.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it("marks only uncommitted candidates ineligible and invalidates valid or committing previews", async () => {
    tx.schoolYearLifecycleCandidate.findMany.mockResolvedValue([
      { id: "candidate-1", lifecycleRunId: "run-1" },
      { id: "candidate-2", lifecycleRunId: "run-1" },
    ]);
    tx.schoolYearLifecyclePreviewRun.findMany.mockResolvedValue([
      { id: "preview-1" },
      { id: "preview-2" },
    ]);
    tx.schoolYearLifecycleCandidate.updateMany.mockResolvedValue({ count: 2 });
    tx.schoolYearLifecyclePreviewRun.updateMany.mockResolvedValue({ count: 2 });

    const result = await repository.reconcileLifecycle(
      {
        schoolYearEnrollmentId: "parent-1",
        campusId: "campus-1",
        cancelledAt,
      },
      tx,
    );

    expect(tx.schoolYearLifecycleCandidate.findMany).toHaveBeenCalledWith({
      where: {
        campusId: "campus-1",
        sourceSchoolYearEnrollmentId: "parent-1",
        committedAt: null,
        status: { not: "NO_LONGER_ELIGIBLE" },
      },
      select: { id: true, lifecycleRunId: true },
      orderBy: { id: "asc" },
    });
    expect(tx.schoolYearLifecycleCandidate.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["candidate-1", "candidate-2"] },
        committedAt: null,
        status: { not: "NO_LONGER_ELIGIBLE" },
      },
      data: {
        status: "NO_LONGER_ELIGIBLE",
        conflictCode: null,
        message: "SOURCE_REGISTRATION_CANCELLED",
        rowVersion: { increment: 1 },
        updatedAt: cancelledAt,
      },
    });
    expect(tx.schoolYearLifecyclePreviewRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["preview-1", "preview-2"] },
        status: { in: ["VALID", "COMMITTING"] },
      },
      data: { status: "INVALIDATED", invalidatedAt: cancelledAt },
    });
    expect(result).toEqual({
      noLongerEligibleCandidateIds: ["candidate-1", "candidate-2"],
      invalidatedPreviewIds: ["preview-1", "preview-2"],
    });
  });

  it("aborts atomically when lifecycle candidate reconciliation loses its CAS", async () => {
    tx.schoolYearLifecycleCandidate.findMany.mockResolvedValue([
      { id: "candidate-1", lifecycleRunId: "run-1" },
    ]);
    tx.schoolYearLifecyclePreviewRun.findMany.mockResolvedValue([]);
    tx.schoolYearLifecycleCandidate.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.reconcileLifecycle(
        {
          schoolYearEnrollmentId: "parent-1",
          campusId: "campus-1",
          cancelledAt,
        },
        tx,
      ),
    ).rejects.toThrow("LIFECYCLE_CANCELLATION_RECONCILIATION_CONFLICT");
  });

  it("aborts atomically when preview invalidation loses its CAS", async () => {
    tx.schoolYearLifecycleCandidate.findMany.mockResolvedValue([
      { id: "candidate-1", lifecycleRunId: "run-1" },
    ]);
    tx.schoolYearLifecyclePreviewRun.findMany.mockResolvedValue([
      { id: "preview-1" },
    ]);
    tx.schoolYearLifecycleCandidate.updateMany.mockResolvedValue({ count: 1 });
    tx.schoolYearLifecyclePreviewRun.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.reconcileLifecycle(
        {
          schoolYearEnrollmentId: "parent-1",
          campusId: "campus-1",
          cancelledAt,
        },
        tx,
      ),
    ).rejects.toThrow("LIFECYCLE_CANCELLATION_RECONCILIATION_CONFLICT");
  });

  it("leaves committed or already-ineligible lifecycle rows untouched", async () => {
    tx.schoolYearLifecycleCandidate.findMany.mockResolvedValue([]);

    const result = await repository.reconcileLifecycle(
      {
        schoolYearEnrollmentId: "parent-1",
        campusId: "campus-1",
        cancelledAt,
      },
      tx,
    );

    expect(result).toEqual({
      noLongerEligibleCandidateIds: [],
      invalidatedPreviewIds: [],
    });
    expect(tx.schoolYearLifecyclePreviewRun.findMany).not.toHaveBeenCalled();
    expect(tx.schoolYearLifecycleCandidate.updateMany).not.toHaveBeenCalled();
  });

  it("completes a partial run when cancellation removes its last remaining candidate", async () => {
    tx.schoolYearLifecycleCandidate.findMany.mockResolvedValue([
      { id: "candidate-2", lifecycleRunId: "run-1" },
    ]);
    tx.schoolYearLifecyclePreviewRun.findMany.mockResolvedValue([]);
    tx.schoolYearLifecycleCandidate.updateMany.mockResolvedValue({ count: 1 });
    tx.schoolYearLifecycleCandidate.groupBy.mockResolvedValue([
      { status: "COMMITTED", _count: { _all: 1 } },
      { status: "NO_LONGER_ELIGIBLE", _count: { _all: 1 } },
    ]);

    await repository.reconcileLifecycle(
      {
        schoolYearEnrollmentId: "parent-1",
        campusId: "campus-1",
        cancelledAt,
        retention: {
          retentionExpiresAt: new Date("2033-07-11T12:00:00.000Z"),
          retentionPolicySource: "campus-default",
        },
      },
      tx,
    );

    expect(tx.schoolYearLifecycleRun.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: "run-1",
        campusId: "campus-1",
        status: expect.objectContaining({
          in: expect.arrayContaining([
            "PARTIALLY_COMMITTED",
            "NEEDS_RECONCILIATION",
          ]),
        }),
      }),
      data: {
        status: "COMPLETED",
        completedAt: cancelledAt,
        retentionExpiresAt: new Date("2033-07-11T12:00:00.000Z"),
        retentionPolicySource: "campus-default",
        lastActivityAt: cancelledAt,
        version: { increment: 1 },
      },
    });
  });

  function parentRow() {
    return PrismaSchoolYearEnrollmentMapper.toPrisma(parent) as any;
  }

  function childRow() {
    return PrismaEnrollmentMapper.toPrisma(child) as any;
  }
});
