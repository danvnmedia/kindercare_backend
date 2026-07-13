import { ForbiddenException } from "@nestjs/common";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import { User } from "@/domain/user-management/user.entity";
import { ExportHistoricalRecordUseCase } from "./export-historical-record.use-case";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";

const campusId = "campus-1";
const recordId = "enrollment-1";
const studentId = "student-1";

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
      snapshotStudentFullName: "Snapshot Student",
      snapshotStudentCode: "SNAP-001",
      snapshotClassName: "Snapshot Class",
    },
    recordId,
  );
}

function cancelledEnrollment(): Enrollment {
  return Enrollment.create(
    {
      classId: "class-1",
      studentId,
      schoolYearEnrollmentId: "sye-1",
      enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      snapshotStudentFullName: "Snapshot Student",
      snapshotStudentCode: "SNAP-001",
      snapshotClassName: "Snapshot Class",
    },
    recordId,
  ).cancel({
    cancelledAt: new Date("2026-07-11T12:00:00.000Z"),
    reason: EnrollmentCancellationReason.FAMILY_REQUEST,
    note: "Relocating",
    actorId: "user-exporter",
    actorFullName: "Alice Nguyen",
  });
}

function actor(withExportPermission: boolean): User {
  return User.reconstitute(
    {
      clerkUid: withExportPermission ? "user_exporter" : "user_viewer",
      isActive: true,
      profile: {
        type: "staff",
        id: "staff-1",
        fullName: "Alice Nguyen",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
      roleAssignments: [
        {
          campusId,
          assignedAt: new Date("2026-01-01T00:00:00.000Z"),
          role: {
            id: withExportPermission ? "export-role" : "view-role",
            name: "Role",
            description: null,
            campusId,
            isSystemDefault: false,
            isSystemRole: false,
            permissions: withExportPermission
              ? [
                  {
                    id: "historical_records.export",
                    module: "historical_records",
                    description: null,
                    createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  },
                ]
              : [],
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    withExportPermission ? "user-exporter" : "user-viewer",
  );
}

describe("ExportHistoricalRecordUseCase", () => {
  let repository: jest.Mocked<HistoricalRecordRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;
  let useCase: ExportHistoricalRecordUseCase;

  beforeEach(() => {
    repository = {
      findCorrections: jest.fn().mockResolvedValue([]),
      findEnrollmentByIdInCampus: jest
        .fn()
        .mockResolvedValue(finalizedEnrollment()),
    } as unknown as jest.Mocked<HistoricalRecordRepository>;
    transactionRunner = {
      run: jest.fn(async (task) => task({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    recorder = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
    useCase = new ExportHistoricalRecordUseCase(
      repository,
      transactionRunner,
      recorder,
    );
  });

  it("returns export-ready historical data and audits successful explicit export permission", async () => {
    const result = await useCase.execute(
      { campusId, recordType: "ENROLLMENT", recordId },
      actor(true),
    );

    expect(result.recordType).toBe("ENROLLMENT");
    expect(result.view.snapshot.student.fullName).toBe("Snapshot Student");
    expect(result.view.effectiveSnapshot.student.fullName).toBe(
      "Snapshot Student",
    );
    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXPORT_HISTORICAL_RECORD",
        targetType: "student",
        targetId: studentId,
        campusId,
        context: expect.objectContaining({
          recordType: "ENROLLMENT",
          recordId,
          outcome: "success",
        }),
      }),
      expect.anything(),
    );
  });

  it("exports cancelled history distinctly without replacing captured snapshots", async () => {
    repository.findEnrollmentByIdInCampus.mockResolvedValueOnce(
      cancelledEnrollment(),
    );

    const result = await useCase.execute(
      { campusId, recordType: "ENROLLMENT", recordId },
      actor(true),
    );

    expect(result.view).toMatchObject({
      effectiveStatus: EnrollmentEffectiveStatus.CANCELLED,
      exitReason: null,
      cancellationReason: EnrollmentCancellationReason.FAMILY_REQUEST,
      cancellationNote: "Relocating",
      cancelledBy: { id: "user-exporter", fullName: "Alice Nguyen" },
      snapshot: {
        student: { fullName: "Snapshot Student", studentCode: "SNAP-001" },
        class: { name: "Snapshot Class" },
      },
    });
  });

  it("audits and rejects export when ordinary history access lacks explicit export permission", async () => {
    await expect(
      useCase.execute(
        { campusId, recordType: "ENROLLMENT", recordId },
        actor(false),
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EXPORT_HISTORICAL_RECORD",
        targetType: "student",
        targetId: studentId,
        campusId,
        context: expect.objectContaining({
          outcome: "denied",
          reason: "missing_permission",
        }),
      }),
      expect.anything(),
    );
  });

  it("accepts explicit export permission from a global role assignment", async () => {
    const exporter = actor(true);
    const [assignment] = exporter.roleAssignments!;
    assignment.campusId = null;

    const result = await useCase.execute(
      { campusId, recordType: "ENROLLMENT", recordId },
      exporter,
    );

    expect(result.recordType).toBe("ENROLLMENT");
    expect(recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ outcome: "success" }),
      }),
      expect.anything(),
    );
  });
});
