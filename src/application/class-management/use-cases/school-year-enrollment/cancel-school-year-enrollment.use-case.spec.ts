import { BadRequestException, NotFoundException } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { EnrollmentCancellationRepository } from "@/application/class-management/ports/enrollment-cancellation.repository";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { createUser } from "@/test-utils/entity-factories";

import { CancelSchoolYearEnrollmentUseCase } from "./cancel-school-year-enrollment.use-case";

describe("CancelSchoolYearEnrollmentUseCase", () => {
  const campusId = "campus-1";
  const parentId = "parent-1";
  const cancelledAt = new Date("2026-07-11T12:00:00.000Z");
  const actor = createUser({
    id: "actor-1",
    profile: {
      type: "staff",
      id: "staff-1",
      campusId,
      fullName: "Alice Admin",
      email: null,
      phoneNumber: null,
      dateOfBirth: null,
      gender: null,
    },
  });
  const tx = {} as never;

  let repository: jest.Mocked<EnrollmentCancellationRepository>;
  let runner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;
  let useCase: CancelSchoolYearEnrollmentUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(cancelledAt);
    repository = {
      findParentById: jest.fn(),
      findChildrenByParentId: jest.fn(),
      cancelParentIfUpcoming: jest.fn(),
      cancelChildrenIfUpcoming: jest.fn(),
      reconcileLifecycle: jest.fn(),
    } as jest.Mocked<EnrollmentCancellationRepository>;
    runner = {
      run: jest.fn((task) => task(tx)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    recorder = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
    useCase = new CancelSchoolYearEnrollmentUseCase(
      repository,
      runner,
      recorder,
    );

    repository.findParentById.mockResolvedValue(upcomingParent());
    repository.findChildrenByParentId.mockResolvedValue([]);
    repository.cancelParentIfUpcoming.mockImplementation(
      async (parent) => parent,
    );
    repository.cancelChildrenIfUpcoming.mockImplementation(
      async (children) => children,
    );
    repository.reconcileLifecycle.mockResolvedValue({
      noLongerEligibleCandidateIds: ["candidate-1"],
      invalidatedPreviewIds: ["preview-1"],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("atomically cancels the upcoming parent and only upcoming children", async () => {
    const upcomingOne = upcomingChild("child-1", "2026-09-01");
    const upcomingTwo = upcomingChild("child-2", "2026-10-01");
    const closed = closedChild("child-closed");
    const alreadyCancelled = upcomingChild(
      "child-cancelled",
      "2026-11-01",
    ).cancel({
      cancelledAt: new Date("2026-07-10T12:00:00.000Z"),
      reason: EnrollmentCancellationReason.DUPLICATE_REGISTRATION,
      actorId: "another-actor",
      actorFullName: "Other Admin",
    });
    repository.findChildrenByParentId.mockResolvedValue([
      upcomingOne,
      closed,
      alreadyCancelled,
      upcomingTwo,
    ]);

    const result = await useCase.execute(
      {
        id: parentId,
        campusId,
        cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
        note: "  family moved  ",
      },
      actor,
    );

    expect(result).toMatchObject({
      resultStatus: EnrollmentEffectiveStatus.CANCELLED,
      affectedChildIds: ["child-1", "child-2"],
      affectedChildCount: 2,
      idempotentReplay: false,
    });
    expect(result.parent.cancellationNote).toBe("family moved");
    expect(result.parent.historicalFinalizedAt).toEqual(cancelledAt);
    expect(
      result.affectedChildren.every(
        (child) =>
          child.getEffectiveStatus(cancelledAt) ===
            EnrollmentEffectiveStatus.CANCELLED &&
          child.historicalFinalizedAt?.getTime() === cancelledAt.getTime(),
      ),
    ).toBe(true);
    expect(repository.cancelChildrenIfUpcoming).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "child-1" }),
        expect.objectContaining({ id: "child-2" }),
      ]),
      cancelledAt,
      tx,
    );
    expect(repository.cancelChildrenIfUpcoming.mock.calls[0][0]).toHaveLength(
      2,
    );
    expect(recorder.record).toHaveBeenCalledTimes(1);
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CANCEL_SCHOOL_YEAR_ENROLLMENT",
        targetType: "student",
        context: expect.objectContaining({
          cancellationNote: "family moved",
          affectedChildIds: ["child-1", "child-2"],
          beforeStatus: EnrollmentEffectiveStatus.UPCOMING,
          afterStatus: EnrollmentEffectiveStatus.CANCELLED,
        }),
      }),
      tx,
    );
  });

  it("rejects an active child and performs no cancellation writes", async () => {
    repository.findChildrenByParentId.mockResolvedValue([
      upcomingChild("child-upcoming", "2026-09-01"),
      activeChild("child-active"),
    ]);

    await expect(execute()).rejects.toMatchObject({
      response: {
        code: "CANCELLATION_CHILD_STATE_CONFLICT",
        childEnrollmentIds: ["child-active"],
        action: "WITHDRAW",
      },
    });
    // The parent CAS occurs inside the transaction before child classification;
    // throwing here rolls that write back with the rest of the unit of work.
    expect(repository.cancelParentIfUpcoming).toHaveBeenCalled();
    expect(repository.cancelChildrenIfUpcoming).not.toHaveBeenCalled();
    expect(repository.reconcileLifecycle).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("rolls back the parent and maps a child CAS race to child-state conflict", async () => {
    repository.findChildrenByParentId
      .mockResolvedValueOnce([upcomingChild("child-1", "2026-09-01")])
      .mockResolvedValueOnce([activeChild("child-1")]);
    repository.cancelChildrenIfUpcoming.mockResolvedValue(null);

    await expect(execute()).rejects.toMatchObject({
      response: {
        code: "CANCELLATION_CHILD_STATE_CONFLICT",
        childEnrollmentIds: ["child-1"],
        action: "WITHDRAW",
      },
    });
    expect(repository.cancelParentIfUpcoming).toHaveBeenCalled();
    expect(repository.reconcileLifecycle).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it.each([
    {
      parent: activeParent(),
      code: "ENROLLMENT_ALREADY_EFFECTIVE",
      action: "WITHDRAW",
    },
    {
      parent: closedParent(),
      code: "ENROLLMENT_ALREADY_CLOSED",
      action: undefined,
    },
  ])(
    "returns $code for a non-upcoming parent",
    async ({ parent, code, action }) => {
      repository.findParentById.mockResolvedValue(parent);

      await expect(execute()).rejects.toMatchObject({
        response: expect.objectContaining({
          code,
          ...(action ? { action } : {}),
        }),
      });
      expect(repository.cancelParentIfUpcoming).not.toHaveBeenCalled();
      expect(recorder.record).not.toHaveBeenCalled();
    },
  );

  it.each([null, upcomingParent({ campusId: "other-campus" })])(
    "uses campus-hidden not-found behavior for missing or cross-campus parents",
    async (parent) => {
      repository.findParentById.mockResolvedValue(parent);

      await expect(execute()).rejects.toBeInstanceOf(NotFoundException);
      expect(runner.run).not.toHaveBeenCalled();
    },
  );

  it("classifies a date-boundary CAS miss as already effective", async () => {
    repository.findParentById
      .mockResolvedValueOnce(upcomingParent())
      .mockResolvedValueOnce(upcomingParent())
      .mockResolvedValueOnce(activeParent());
    repository.cancelParentIfUpcoming.mockResolvedValue(null);

    await expect(execute()).rejects.toMatchObject({
      response: {
        code: "ENROLLMENT_ALREADY_EFFECTIVE",
        currentStatus: EnrollmentEffectiveStatus.ACTIVE,
        action: "WITHDRAW",
      },
    });
    expect(repository.cancelChildrenIfUpcoming).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("maps a deferred commit-time UTC boundary failure and relies on transaction rollback", async () => {
    runner.run.mockRejectedValue({
      message:
        "constraint sye_cancel_requires_upcoming_at_commit: ENROLLMENT_ALREADY_EFFECTIVE",
    });

    await expect(execute()).rejects.toMatchObject({
      response: {
        code: "ENROLLMENT_ALREADY_EFFECTIVE",
        currentStatus: EnrollmentEffectiveStatus.ACTIVE,
        action: "WITHDRAW",
      },
    });
  });

  it("maps a deferred child boundary failure to child-state conflict", async () => {
    runner.run.mockRejectedValue({
      message:
        "constraint enrollment_cancel_requires_upcoming_at_commit: CANCELLATION_CHILD_STATE_CONFLICT",
    });

    await expect(execute()).rejects.toMatchObject({
      response: {
        code: "CANCELLATION_CHILD_STATE_CONFLICT",
        action: "WITHDRAW",
      },
    });
  });

  it("maps a Lifecycle reconciliation CAS loss to a stable concurrent-modification conflict", async () => {
    runner.run.mockRejectedValue(
      new Error("LIFECYCLE_CANCELLATION_RECONCILIATION_CONFLICT"),
    );

    await expect(execute()).rejects.toMatchObject({
      response: {
        code: "ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION",
      },
    });
  });

  it("keeps campus-hidden 404 behavior when the parent disappears after a CAS miss", async () => {
    repository.findParentById
      .mockResolvedValueOnce(upcomingParent())
      .mockResolvedValueOnce(upcomingParent())
      .mockResolvedValueOnce(null);
    repository.cancelParentIfUpcoming.mockResolvedValue(null);

    await expect(execute()).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.cancelChildrenIfUpcoming).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("returns a stable concurrent-modification conflict for an unclassified CAS miss", async () => {
    repository.cancelParentIfUpcoming.mockResolvedValue(null);

    await expect(execute()).rejects.toMatchObject({
      response: {
        code: "ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION",
        currentStatus: EnrollmentEffectiveStatus.UPCOMING,
      },
    });
    expect(repository.cancelChildrenIfUpcoming).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("returns the original affected-child scope on idempotent replay without a transaction or audit", async () => {
    const parent = cancelledParent();
    const affected = cancelledChildWithParent("child-affected", parent);
    const previouslyCancelled = upcomingChild(
      "child-previous",
      "2026-10-01",
    ).cancel({
      cancelledAt: new Date("2026-07-10T12:00:00.000Z"),
      reason: EnrollmentCancellationReason.OTHER,
      actorId: "another-actor",
    });
    repository.findParentById.mockResolvedValue(parent);
    repository.findChildrenByParentId.mockResolvedValue([
      affected,
      previouslyCancelled,
      closedChild("child-closed"),
    ]);

    const result = await execute();

    expect(result).toMatchObject({
      idempotentReplay: true,
      affectedChildIds: ["child-affected"],
      affectedChildCount: 1,
    });
    expect(runner.run).not.toHaveBeenCalled();
    expect(repository.cancelParentIfUpcoming).not.toHaveBeenCalled();
    expect(repository.cancelChildrenIfUpcoming).not.toHaveBeenCalled();
    expect(repository.reconcileLifecycle).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("returns idempotent replay when another transaction wins the CAS race", async () => {
    const parent = cancelledParent();
    repository.findParentById
      .mockResolvedValueOnce(upcomingParent())
      .mockResolvedValueOnce(upcomingParent())
      .mockResolvedValueOnce(parent);
    repository.cancelParentIfUpcoming.mockResolvedValue(null);
    repository.findChildrenByParentId.mockResolvedValue([
      cancelledChildWithParent("child-affected", parent),
    ]);

    const result = await execute();

    expect(result.idempotentReplay).toBe(true);
    expect(result.affectedChildIds).toEqual(["child-affected"]);
    expect(repository.cancelChildrenIfUpcoming).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("propagates audit failure so the surrounding transaction rolls back", async () => {
    repository.findChildrenByParentId.mockResolvedValue([
      upcomingChild("child-1", "2026-09-01"),
    ]);
    const auditFailure = new Error("audit failed");
    recorder.record.mockRejectedValue(auditFailure);

    await expect(execute()).rejects.toBe(auditFailure);
    expect(repository.cancelParentIfUpcoming).toHaveBeenCalled();
    expect(repository.cancelChildrenIfUpcoming).toHaveBeenCalled();
    expect(repository.reconcileLifecycle).toHaveBeenCalled();
  });

  it("rejects invalid reason and oversized notes before persistence", async () => {
    await expect(
      useCase.execute(
        {
          id: parentId,
          campusId,
          cancellationReason: "INVALID" as EnrollmentCancellationReason,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      useCase.execute(
        {
          id: parentId,
          campusId,
          cancellationReason: EnrollmentCancellationReason.OTHER,
          note: "x".repeat(501),
        },
        actor,
      ),
    ).rejects.toThrow("CANCELLATION_NOTE_TOO_LONG");
    expect(repository.findParentById).not.toHaveBeenCalled();
  });

  function execute() {
    return useCase.execute(
      {
        id: parentId,
        campusId,
        cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
        note: "family request",
      },
      actor,
    );
  }

  function upcomingParent(
    overrides: { campusId?: string } = {},
  ): SchoolYearEnrollment {
    return SchoolYearEnrollment.create(
      {
        studentId: "student-1",
        campusId: overrides.campusId ?? campusId,
        schoolYearId: "school-year-1",
        gradeLevelId: "grade-1",
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      },
      parentId,
    );
  }

  function activeParent(): SchoolYearEnrollment {
    return SchoolYearEnrollment.create(
      {
        studentId: "student-1",
        campusId,
        schoolYearId: "school-year-1",
        gradeLevelId: "grade-1",
        enrollmentDate: new Date("2026-07-01T00:00:00.000Z"),
      },
      parentId,
    );
  }

  function closedParent(): SchoolYearEnrollment {
    return SchoolYearEnrollment.create(
      {
        studentId: "student-1",
        campusId,
        schoolYearId: "school-year-1",
        gradeLevelId: "grade-1",
        enrollmentDate: new Date("2026-01-01T00:00:00.000Z"),
        exitDate: new Date("2026-06-30T00:00:00.000Z"),
        exitReason: ExitReason.COMPLETED,
      },
      parentId,
    );
  }

  function cancelledParent(): SchoolYearEnrollment {
    return upcomingParent().cancel({
      cancelledAt,
      reason: EnrollmentCancellationReason.FAMILY_REQUEST,
      note: "family request",
      actorId: actor.id,
      actorFullName: "Alice Admin",
    });
  }

  function upcomingChild(id: string, start: string): Enrollment {
    return Enrollment.create(
      {
        classId: `class-${id}`,
        studentId: "student-1",
        schoolYearEnrollmentId: parentId,
        enrollmentDate: new Date(`${start}T00:00:00.000Z`),
      },
      id,
    );
  }

  function activeChild(id: string): Enrollment {
    return Enrollment.create(
      {
        classId: `class-${id}`,
        studentId: "student-1",
        schoolYearEnrollmentId: parentId,
        enrollmentDate: new Date("2026-07-01T00:00:00.000Z"),
      },
      id,
    );
  }

  function closedChild(id: string): Enrollment {
    return Enrollment.create(
      {
        classId: `class-${id}`,
        studentId: "student-1",
        schoolYearEnrollmentId: parentId,
        enrollmentDate: new Date("2026-01-01T00:00:00.000Z"),
        endDate: new Date("2026-06-30T00:00:00.000Z"),
        exitReason: ExitReason.COMPLETED,
      },
      id,
    );
  }

  function cancelledChildWithParent(
    id: string,
    parent: SchoolYearEnrollment,
  ): Enrollment {
    return upcomingChild(id, "2026-09-01").cancel({
      cancelledAt: parent.cancelledAt!,
      reason: parent.cancellationReason!,
      note: parent.cancellationNote,
      actorId: parent.cancelledByUserId!,
      actorFullName: parent.cancelledByFullName,
    });
  }
});
