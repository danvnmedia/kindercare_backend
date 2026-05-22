import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { WithdrawStudentUseCase } from "./withdraw-student.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { User } from "@/domain/user-management/user.entity";
import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";

const stubActor = User.reconstitute(
  {
    clerkUid: "user_audit12345",
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

const stubTx = {} as unknown as AppTransactionClient;

describe("WithdrawStudentUseCase", () => {
  let useCase: WithdrawStudentUseCase;
  let repo: jest.Mocked<EnrollmentRepository>;
  let runner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const enrollmentId = "enroll-1";
  const classId = "class-1";
  const studentId = "student-1";
  // Stable past date so endDate-before-enrollmentDate edge stays well-defined
  // and default-today is always > enrollmentDate regardless of when the test runs.
  const enrollmentDate = new Date("2020-01-15T00:00:00.000Z");

  const buildClass = (overrides: { campusId?: string } = {}): Class =>
    Class.create(
      {
        name: "Lớp A1",
        campusId: overrides.campusId ?? campusId,
        gradeLevelId: "grade-1",
        schoolYearId: "year-1",
        description: null,
      },
      classId,
    );

  const buildActiveEnrollment = (
    overrides: { campusId?: string } = {},
  ): Enrollment =>
    Enrollment.create(
      {
        classId,
        studentId,
        schoolYearEnrollmentId: "sye-test",
        enrollmentDate,
        endDate: null,
        exitReason: null,
        note: null,
        class: buildClass({ campusId: overrides.campusId }),
      },
      enrollmentId,
    );

  const buildClosedEnrollment = (): Enrollment =>
    Enrollment.create(
      {
        classId,
        studentId,
        schoolYearEnrollmentId: "sye-test",
        enrollmentDate,
        endDate: new Date("2020-03-01T00:00:00.000Z"),
        exitReason: ExitReason.WITHDRAWN,
        note: null,
        class: buildClass(),
      },
      enrollmentId,
    );

  const todayUtcDateOnly = (): Date => {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  };

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      findByStudentClassDate: jest.fn(),
      findByClassId: jest.fn(),
      findByStudentId: jest.fn(),
      findActiveByStudentId: jest.fn(),
      findActiveByClassId: jest.fn(),
      findHistoricalByClassId: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      transferEnrollment: jest.fn(),
      saveMany: jest.fn(),
    } as jest.Mocked<EnrollmentRepository>;
    runner = {
      run: jest.fn((task) => task(stubTx)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    recorder = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
    useCase = new WithdrawStudentUseCase(repo, runner, recorder);
  });

  describe("AC-9: default-today happy path", () => {
    it("closes the period with today's UTC date when endDate is omitted", async () => {
      repo.findById.mockResolvedValue(buildActiveEnrollment());
      repo.update.mockImplementation(async (e) => e);

      const result = await useCase.execute(
        {
          enrollmentId,
          campusId,
          reason: ExitReason.WITHDRAWN,
        },
        stubActor,
      );

      expect(result.endDate).toEqual(todayUtcDateOnly());
      expect(result.exitReason).toBe(ExitReason.WITHDRAWN);
      expect(result.isActive()).toBe(false);
      expect(result.id).toBe(enrollmentId);
      expect(repo.update).toHaveBeenCalledTimes(1);
      const persisted = repo.update.mock.calls[0][0];
      expect(persisted.endDate).toEqual(todayUtcDateOnly());
      expect(persisted.exitReason).toBe(ExitReason.WITHDRAWN);
    });
  });

  describe("AC-10: idempotent close — second withdraw fails", () => {
    it("throws ConflictException ENROLLMENT_ALREADY_CLOSED on already-closed row", async () => {
      repo.findById.mockResolvedValue(buildClosedEnrollment());

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
          },
          stubActor,
        ),
      ).rejects.toThrow("ENROLLMENT_ALREADY_CLOSED");

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe("AC-11: explicit endDate honored", () => {
    it("uses the supplied endDate verbatim (UTC date-only)", async () => {
      repo.findById.mockResolvedValue(buildActiveEnrollment());
      repo.update.mockImplementation(async (e) => e);
      const explicit = new Date("2020-06-01T00:00:00.000Z");

      const result = await useCase.execute(
        {
          enrollmentId,
          campusId,
          reason: ExitReason.TRANSFERRED,
          endDate: explicit,
        },
        stubActor,
      );

      expect(result.endDate).toEqual(explicit);
      expect(result.exitReason).toBe(ExitReason.TRANSFERRED);
    });
  });

  describe("AC-12: invalid endDate", () => {
    it("rejects endDate before enrollmentDate with INVALID_END_DATE", async () => {
      repo.findById.mockResolvedValue(buildActiveEnrollment());
      const tooEarly = new Date("2019-12-31T00:00:00.000Z");

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
            endDate: tooEarly,
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
            endDate: tooEarly,
          },
          stubActor,
        ),
      ).rejects.toThrow(/INVALID_END_DATE/);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rejects endDate in the future with INVALID_END_DATE", async () => {
      repo.findById.mockResolvedValue(buildActiveEnrollment());
      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
            endDate: oneWeekFromNow,
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
            endDate: oneWeekFromNow,
          },
          stubActor,
        ),
      ).rejects.toThrow(/INVALID_END_DATE/);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe("AC-13: cross-campus rejection", () => {
    it("returns 404 NotFoundException when class belongs to a different campus (hide existence)", async () => {
      repo.findById.mockResolvedValue(
        buildActiveEnrollment({ campusId: otherCampusId }),
      );

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
          },
          stubActor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe("not-found", () => {
    it("throws NotFoundException when enrollment does not exist", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
          },
          stubActor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe("optional note", () => {
    it("applies the note before withdraw so the persisted row carries it", async () => {
      repo.findById.mockResolvedValue(buildActiveEnrollment());
      repo.update.mockImplementation(async (e) => e);

      const result = await useCase.execute(
        {
          enrollmentId,
          campusId,
          reason: ExitReason.WITHDRAWN,
          note: "Family relocated overseas",
        },
        stubActor,
      );

      expect(result.note).toBe("Family relocated overseas");
      const persisted = repo.update.mock.calls[0][0];
      expect(persisted.note).toBe("Family relocated overseas");
    });

    it("leaves note untouched when omitted", async () => {
      const active = buildActiveEnrollment();
      const originalNote = active.note;
      repo.findById.mockResolvedValue(active);
      repo.update.mockImplementation(async (e) => e);

      const result = await useCase.execute(
        {
          enrollmentId,
          campusId,
          reason: ExitReason.WITHDRAWN,
        },
        stubActor,
      );

      expect(result.note).toBe(originalNote);
    });
  });

  describe("audit-log emission (admin-audit-log AC-3 / AC-7)", () => {
    it("emits WITHDRAW_FROM_CLASS audit row inside the same tx", async () => {
      repo.findById.mockResolvedValue(buildActiveEnrollment());
      repo.update.mockImplementation(async (e) => e);
      const exitDate = new Date("2020-04-01T00:00:00.000Z");

      await useCase.execute(
        {
          enrollmentId,
          campusId,
          reason: ExitReason.WITHDRAWN,
          endDate: exitDate,
          note: "Family move",
        },
        stubActor,
      );

      expect(recorder.record).toHaveBeenCalledTimes(1);
      const [auditInput, txArg] = recorder.record.mock.calls[0];
      expect(auditInput).toMatchObject({
        actorId: stubActor.id,
        action: "WITHDRAW_FROM_CLASS",
        targetType: "student",
        targetId: studentId,
        campusId,
      });
      expect(auditInput.context).toMatchObject({
        actorName: "Alice Nguyen",
        classId,
        className: "Lớp A1",
        exitReason: ExitReason.WITHDRAWN,
        exitDate: exitDate.toISOString(),
        note: "Family move",
      });
      // Same tx instance the runner handed to the use case — proves both
      // writes (the update + the audit emit) participate in one logical UoW.
      expect(txArg).toBe(stubTx);
    });
  });

  describe("rollback on recorder failure (admin-audit-log AC-4 / Scenario 2)", () => {
    it("propagates the recorder error so the outer tx rolls back", async () => {
      repo.findById.mockResolvedValue(buildActiveEnrollment());
      repo.update.mockImplementation(async (e) => e);
      const auditFailure = new Error("audit failure");
      recorder.record.mockRejectedValue(auditFailure);

      await expect(
        useCase.execute(
          {
            enrollmentId,
            campusId,
            reason: ExitReason.WITHDRAWN,
          },
          stubActor,
        ),
      ).rejects.toBe(auditFailure);

      // repo.update was called inside the tx — a real DB would roll it back
      // when the recorder throw bubbles out of `runner.run`. We assert the
      // call happened (proving the emit truly co-runs in one tx).
      expect(repo.update).toHaveBeenCalledTimes(1);
    });
  });
});
