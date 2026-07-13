import { BadRequestException } from "@nestjs/common";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { User } from "@/domain/user-management/user.entity";
import { CorrectHistoricalRecordUseCase } from "./correct-historical-record.use-case";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";

const campusId = "campus-1";
const recordId = "enrollment-1";
const studentId = "student-1";
const actorId = "actor-1";

function finalizedEnrollment(): Enrollment {
  return Enrollment.create(
    {
      classId: "class-1",
      studentId,
      schoolYearEnrollmentId: "sye-1",
      enrollmentDate: new Date("2024-09-01T00:00:00.000Z"),
      endDate: new Date("2025-01-31T00:00:00.000Z"),
      exitReason: ExitReason.WITHDRAWN,
      note: null,
      snapshotStudentFullName: "Original Student",
      snapshotStudentCode: "SNAP-001",
      snapshotClassName: "Original Class",
    },
    recordId,
  );
}

function actor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_actor",
      isActive: true,
      profile: {
        type: "staff",
        id: actorId,
        fullName: "Alice Nguyen",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    actorId,
  );
}

describe("CorrectHistoricalRecordUseCase", () => {
  let repository: jest.Mocked<HistoricalRecordRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;
  let useCase: CorrectHistoricalRecordUseCase;

  beforeEach(() => {
    repository = {
      findEnrollmentByIdInCampus: jest
        .fn()
        .mockResolvedValue(finalizedEnrollment()),
      findCorrections: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "correction-1",
            campusId,
            recordType: "ENROLLMENT",
            recordId,
            actorId,
            reason: "Legal name correction",
            beforeValue: {
              studentFullName: "Original Student",
              studentCode: "SNAP-001",
              className: "Original Class",
            },
            afterValue: { studentFullName: "Corrected Student" },
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]),
      appendCorrection: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<HistoricalRecordRepository>;
    transactionRunner = {
      run: jest.fn(async (task) => task({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    recorder = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
    useCase = new CorrectHistoricalRecordUseCase(
      repository,
      transactionRunner,
      recorder,
    );
  });

  it("requires a non-empty correction reason before reading or writing records", async () => {
    await expect(
      useCase.execute(
        {
          campusId,
          recordType: "ENROLLMENT",
          recordId,
          reason: "   ",
          afterValue: { studentFullName: "Corrected Student" },
        },
        actor(),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(repository.findEnrollmentByIdInCampus).not.toHaveBeenCalled();
    expect(repository.appendCorrection).not.toHaveBeenCalled();
  });

  it("appends a correction event, audits metadata, and returns the effective corrected view without changing original snapshot", async () => {
    const result = await useCase.execute(
      {
        campusId,
        recordType: "ENROLLMENT",
        recordId,
        reason: " Legal name correction ",
        afterValue: { studentFullName: "Corrected Student" },
      },
      actor(),
    );

    expect(repository.appendCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId,
        recordType: "ENROLLMENT",
        recordId,
        actorId,
        reason: "Legal name correction",
        beforeValue: expect.objectContaining({
          studentFullName: "Original Student",
          className: "Original Class",
        }),
        afterValue: { studentFullName: "Corrected Student" },
      }),
      expect.anything(),
    );
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CORRECT_HISTORICAL_RECORD",
        targetType: "student",
        targetId: studentId,
        beforeValue: expect.objectContaining({
          studentFullName: "Original Student",
        }),
        afterValue: { studentFullName: "Corrected Student" },
        context: expect.objectContaining({
          reason: "Legal name correction",
        }),
      }),
      expect.anything(),
    );
    expect(result.view.snapshot.student.fullName).toBe("Original Student");
    expect(result.view.effectiveSnapshot.student.fullName).toBe(
      "Corrected Student",
    );
    expect(result.view.correctionSummary.appliedCount).toBe(1);
  });
});
