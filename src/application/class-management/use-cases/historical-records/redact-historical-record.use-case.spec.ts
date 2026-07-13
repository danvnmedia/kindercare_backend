import { ConflictException } from "@nestjs/common";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { User } from "@/domain/user-management/user.entity";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { RedactHistoricalRecordUseCase } from "./redact-historical-record.use-case";

const campusId = "campus-1";
const recordId = "enrollment-1";
const studentId = "student-1";

function retainedEnrollment(
  options: { legalHold?: boolean; finalized?: boolean } = {},
): Enrollment {
  const finalized = options.finalized ?? true;
  return Enrollment.create(
    {
      classId: "class-1",
      studentId,
      schoolYearEnrollmentId: "sye-1",
      enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
      endDate: finalized ? new Date("2025-01-31T00:00:00.000Z") : null,
      exitReason: finalized ? ExitReason.WITHDRAWN : null,
      note: null,
      snapshotStudentFullName: "Snapshot Student",
      snapshotStudentCode: "SNAP-001",
      snapshotStudentNickname: "Snap",
      snapshotClassName: "Snapshot Class",
      retentionExpiresAt: new Date("2000-01-01T00:00:00.000Z"),
      retentionPolicySource: "campus-default",
      legalHold: options.legalHold ?? false,
    },
    recordId,
  );
}

function actor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_redactor",
      isActive: true,
      profile: {
        type: "staff",
        id: "actor-1",
        fullName: "Alice Nguyen",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    "actor-1",
  );
}

describe("RedactHistoricalRecordUseCase", () => {
  let repository: jest.Mocked<HistoricalRecordRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;
  let useCase: RedactHistoricalRecordUseCase;

  beforeEach(() => {
    repository = {
      findCorrections: jest.fn().mockResolvedValue([]),
      findEnrollmentByIdInCampus: jest
        .fn()
        .mockResolvedValue(retainedEnrollment()),
      findRetentionPolicy: jest.fn().mockResolvedValue({
        id: "policy-1",
        campusId,
        environment: null,
        policySource: "campus-default",
        retentionDays: 0,
        deletionAllowed: true,
        redactionAllowed: true,
        isActive: true,
      }),
      redactRecord: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<HistoricalRecordRepository>;
    transactionRunner = {
      run: jest.fn(async (task) => task({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    recorder = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
    useCase = new RedactHistoricalRecordUseCase(
      repository,
      transactionRunner,
      recorder,
    );
  });

  it("blocks redaction when no retention policy is configured", async () => {
    repository.findRetentionPolicy.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(
        {
          campusId,
          recordType: "ENROLLMENT",
          recordId,
          reason: "Retention request",
        },
        actor(),
      ),
    ).rejects.toThrow(ConflictException);

    expect(repository.redactRecord).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("blocks redaction for non-finalized records before applying retention policy", async () => {
    repository.findEnrollmentByIdInCampus.mockResolvedValueOnce(
      retainedEnrollment({ finalized: false }),
    );

    await expect(
      useCase.execute(
        {
          campusId,
          recordType: "ENROLLMENT",
          recordId,
          reason: "Retention request",
        },
        actor(),
      ),
    ).rejects.toThrow(ConflictException);

    expect(repository.findRetentionPolicy).not.toHaveBeenCalled();
    expect(repository.redactRecord).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("redacts eligible historical snapshot fields and records audit metadata", async () => {
    await useCase.execute(
      {
        campusId,
        recordType: "ENROLLMENT",
        recordId,
        reason: "Retention request",
      },
      actor(),
    );

    expect(repository.redactRecord).toHaveBeenCalledWith(
      "ENROLLMENT",
      recordId,
      expect.objectContaining({
        redactedAt: expect.any(Date),
        retentionPolicySource: "campus-default",
      }),
      expect.anything(),
    );
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REDACT_HISTORICAL_RECORD",
        targetType: "student",
        targetId: studentId,
        campusId,
        context: expect.objectContaining({
          reason: "Retention request",
          policySource: "campus-default",
        }),
      }),
      expect.anything(),
    );
  });

  it("blocks policy-eligible records when legal hold is active", async () => {
    repository.findEnrollmentByIdInCampus.mockResolvedValueOnce(
      retainedEnrollment({ legalHold: true }),
    );

    await expect(
      useCase.execute(
        {
          campusId,
          recordType: "ENROLLMENT",
          recordId,
          reason: "Retention request",
        },
        actor(),
      ),
    ).rejects.toThrow(ConflictException);

    expect(repository.redactRecord).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });
});
