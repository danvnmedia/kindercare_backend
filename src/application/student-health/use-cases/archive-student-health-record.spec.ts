import { BadRequestException, NotFoundException } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  StudentHealthCheckup,
  StudentHealthCheckupType,
} from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";
import { createStudent, createUser } from "@/test-utils";

import {
  StudentHealthArchiveRepository,
  archiveStudentHealthRecord,
} from "./archive-student-health-record";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const STUDENT_ID = "22222222-2222-4222-a222-222222222222";
const CHECKUP_ID = "33333333-3333-4333-a333-333333333333";
const ACTOR_ID = "44444444-4444-4444-a444-444444444444";
const ARCHIVED_AT = new Date("2026-07-14T15:00:00.000Z");

function makeCheckup(
  archive: { archivedAt: Date; archivedByUserId: string } | null = null,
): StudentHealthCheckup {
  return StudentHealthCheckup.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      checkupType: StudentHealthCheckupType.GENERAL,
      checkedAt: new Date("2020-01-15T09:00:00.000Z"),
      notes: "Routine checkup.",
      archivedAt: archive?.archivedAt ?? null,
      archivedByUserId: archive?.archivedByUserId ?? null,
    },
    CHECKUP_ID,
  );
}

describe("archiveStudentHealthRecord", () => {
  let repository: jest.Mocked<
    StudentHealthArchiveRepository<StudentHealthCheckup>
  >;
  let studentRepository: jest.Mocked<StudentRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let auditRecorder: jest.Mocked<AuditEventRecorderPort>;
  let currentUser: User;
  let tx: AppTransactionClient;

  beforeEach(() => {
    repository = {
      findByIdForStudentInCampus: jest.fn(),
      archiveIfActive: jest.fn(),
    };
    studentRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(
          createStudent({ id: STUDENT_ID, campusId: CAMPUS_ID }),
        ),
    } as unknown as jest.Mocked<StudentRepository>;
    tx = {} as AppTransactionClient;
    transactionRunner = {
      run: jest.fn(async (task) => task(tx)),
    } as jest.Mocked<TransactionRunnerPort>;
    auditRecorder = {
      record: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
    currentUser = createUser({
      id: ACTOR_ID,
      profile: {
        type: "staff",
        id: ACTOR_ID,
        campusId: CAMPUS_ID,
        fullName: "School Nurse",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
    });
  });

  function execute() {
    return archiveStudentHealthRecord({
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      recordId: CHECKUP_ID,
      currentUser,
      now: ARCHIVED_AT,
      repository,
      studentRepository,
      transactionRunner,
      auditRecorder,
      auditAction: "ARCHIVE_STUDENT_HEALTH_CHECKUP",
      auditTargetType: "student_health_checkup",
      notFoundMessage: "Student health checkup not found",
    });
  }

  it("masks missing, cross-campus, and mismatched ownership as not found", async () => {
    repository.findByIdForStudentInCampus.mockResolvedValue(null);

    await expect(execute()).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.findByIdForStudentInCampus).toHaveBeenCalledWith(
      CAMPUS_ID,
      STUDENT_ID,
      CHECKUP_ID,
    );
    expect(studentRepository.findById).not.toHaveBeenCalled();
    expect(transactionRunner.run).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("archives once and records the winner audit in the same transaction", async () => {
    repository.findByIdForStudentInCampus
      .mockResolvedValueOnce(makeCheckup())
      .mockResolvedValueOnce(makeCheckup());
    repository.archiveIfActive.mockImplementation(async (record) => record);

    const result = await execute();

    expect(result).toMatchObject({
      isArchived: true,
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ACTOR_ID,
    });
    expect(repository.archiveIfActive).toHaveBeenCalledWith(
      expect.objectContaining({ isArchived: true }),
      tx,
    );
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        action: "ARCHIVE_STUDENT_HEALTH_CHECKUP",
        targetType: "student_health_checkup",
        targetId: CHECKUP_ID,
        campusId: CAMPUS_ID,
        context: {
          actorName: "School Nurse",
          studentId: STUDENT_ID,
        },
        beforeValue: {
          archivedAt: null,
          archivedByUserId: null,
          isArchived: false,
        },
        afterValue: {
          archivedAt: ARCHIVED_AT.toISOString(),
          archivedByUserId: ACTOR_ID,
          isArchived: true,
        },
      }),
      tx,
    );
  });

  it("returns an existing archive before checking an archived student", async () => {
    const archived = makeCheckup({
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ACTOR_ID,
    });
    repository.findByIdForStudentInCampus.mockResolvedValue(archived);
    studentRepository.findById.mockResolvedValue(
      createStudent({
        id: STUDENT_ID,
        campusId: CAMPUS_ID,
        isArchived: true,
      }),
    );

    await expect(execute()).resolves.toBe(archived);

    expect(studentRepository.findById).not.toHaveBeenCalled();
    expect(transactionRunner.run).not.toHaveBeenCalled();
    expect(repository.archiveIfActive).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("rejects first-time archival for an archived student", async () => {
    repository.findByIdForStudentInCampus.mockResolvedValue(makeCheckup());
    studentRepository.findById.mockResolvedValue(
      createStudent({
        id: STUDENT_ID,
        campusId: CAMPUS_ID,
        isArchived: true,
      }),
    );

    await expect(execute()).rejects.toBeInstanceOf(BadRequestException);

    expect(transactionRunner.run).not.toHaveBeenCalled();
    expect(repository.archiveIfActive).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("returns the persisted winner when a concurrent archive wins", async () => {
    const winner = makeCheckup({
      archivedAt: ARCHIVED_AT,
      archivedByUserId: ACTOR_ID,
    });
    repository.findByIdForStudentInCampus
      .mockResolvedValueOnce(makeCheckup())
      .mockResolvedValueOnce(makeCheckup())
      .mockResolvedValueOnce(winner);
    repository.archiveIfActive.mockResolvedValue(null);

    await expect(execute()).resolves.toBe(winner);

    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("keeps concurrent requests idempotent with exactly one audit event", async () => {
    let persistedArchive: {
      archivedAt: Date;
      archivedByUserId: string;
    } | null = null;
    repository.findByIdForStudentInCampus.mockImplementation(async () =>
      makeCheckup(persistedArchive),
    );
    repository.archiveIfActive.mockImplementation(async (record) => {
      await Promise.resolve();
      if (persistedArchive) {
        return null;
      }
      persistedArchive = {
        archivedAt: record.archivedAt as Date,
        archivedByUserId: record.archivedByUserId as string,
      };
      return makeCheckup(persistedArchive);
    });

    const [first, second] = await Promise.all([execute(), execute()]);

    expect(first.archivedAt).toEqual(ARCHIVED_AT);
    expect(second.archivedAt).toEqual(ARCHIVED_AT);
    expect(first.archivedByUserId).toBe(ACTOR_ID);
    expect(second.archivedByUserId).toBe(ACTOR_ID);
    expect(auditRecorder.record).toHaveBeenCalledTimes(1);
  });
});
