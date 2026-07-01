import { BadRequestException, NotFoundException } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentHealthCheckupRepository } from "@/application/student-health";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  StudentHealthCheckup,
  StudentHealthCheckupType,
} from "@/domain/student-health";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";

import { CreateStudentHealthCheckupUseCase } from "./create-student-health-checkup.use-case";
import { GetStudentHealthCheckupsUseCase } from "./get-student-health-checkups.use-case";
import { UpdateStudentHealthCheckupUseCase } from "./update-student-health-checkup.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const STUDENT_ID = "33333333-3333-4333-a333-333333333333";
const CHECKUP_ID = "44444444-4444-4444-a444-444444444444";
const ACTOR_ID = "55555555-5555-4555-a555-555555555555";
const CHECKED_AT = new Date("2020-01-15T09:00:00.000Z");

const CURRENT_USER = {
  id: ACTOR_ID,
  profile: { fullName: "School Nurse" },
} as User;

function makeStudent(
  overrides: Partial<{ campusId: string; isArchived: boolean }> = {},
) {
  return Student.create(
    {
      campusId: overrides.campusId ?? CAMPUS_ID,
      studentCode: "STU-001",
      fullName: "Alice Student",
      email: null,
      phoneNumber: null,
      address: null,
      dateOfBirth: null,
      nickname: null,
      gender: Gender.FEMALE,
      isArchived: overrides.isArchived ?? false,
    },
    STUDENT_ID,
  );
}

function makeCheckup(
  overrides: Partial<{
    heightCm: number | null;
    weightKg: number | null;
    notes: string | null;
  }> = {},
) {
  return StudentHealthCheckup.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      checkupType: StudentHealthCheckupType.GENERAL,
      checkedAt: CHECKED_AT,
      heightCm: Object.prototype.hasOwnProperty.call(overrides, "heightCm")
        ? overrides.heightCm
        : 108.5,
      weightKg: Object.prototype.hasOwnProperty.call(overrides, "weightKg")
        ? overrides.weightKg
        : 18.6,
      notes: Object.prototype.hasOwnProperty.call(overrides, "notes")
        ? overrides.notes
        : "Routine measurement",
      recordedByUserId: ACTOR_ID,
      recordedBy: { id: ACTOR_ID, fullName: "School Nurse" },
    },
    CHECKUP_ID,
  );
}

describe("Student health checkup use cases", () => {
  let checkupRepository: jest.Mocked<StudentHealthCheckupRepository>;
  let studentRepository: jest.Mocked<StudentRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let auditRecorder: jest.Mocked<AuditEventRecorderPort>;

  beforeEach(() => {
    checkupRepository = {
      findByStudentInCampus: jest.fn(),
      findByIdForStudentInCampus: jest.fn(),
      create: jest.fn(async (checkup) => checkup),
      update: jest.fn(async (checkup) => checkup),
    } as unknown as jest.Mocked<StudentHealthCheckupRepository>;
    studentRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StudentRepository>;
    transactionRunner = {
      run: jest.fn(async (task) => task({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    auditRecorder = {
      record: jest.fn(async () => undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;
  });

  it("lists checkups only after confirming the student belongs to the campus", async () => {
    const params = { limit: 10, offset: 0 };
    const result = { data: [makeCheckup()], pagination: {} as never };
    studentRepository.findById.mockResolvedValue(makeStudent());
    checkupRepository.findByStudentInCampus.mockResolvedValue(result);

    const useCase = new GetStudentHealthCheckupsUseCase(
      checkupRepository,
      studentRepository,
    );

    await expect(
      useCase.execute({ campusId: CAMPUS_ID, studentId: STUDENT_ID, params }),
    ).resolves.toBe(result);
    expect(checkupRepository.findByStudentInCampus).toHaveBeenCalledWith(
      CAMPUS_ID,
      STUDENT_ID,
      params,
    );
  });

  it("hides cross-campus students as not found", async () => {
    studentRepository.findById.mockResolvedValue(
      makeStudent({ campusId: OTHER_CAMPUS_ID }),
    );

    const useCase = new GetStudentHealthCheckupsUseCase(
      checkupRepository,
      studentRepository,
    );

    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        params: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(checkupRepository.findByStudentInCampus).not.toHaveBeenCalled();
  });

  it("creates a default GENERAL checkup, trims notes, and audits in the same transaction", async () => {
    studentRepository.findById.mockResolvedValue(makeStudent());

    const useCase = new CreateStudentHealthCheckupUseCase(
      checkupRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    const result = await useCase.execute(
      CAMPUS_ID,
      STUDENT_ID,
      {
        checkedAt: CHECKED_AT,
        heightCm: 108.5,
        notes: "  Routine measurement.  ",
      },
      CURRENT_USER,
    );

    expect(result.checkupType).toBe(StudentHealthCheckupType.GENERAL);
    expect(result.notes).toBe("Routine measurement.");
    expect(checkupRepository.create).toHaveBeenCalledWith(result, {});
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        action: "CREATE_STUDENT_HEALTH_CHECKUP",
        targetType: "student_health_checkup",
        campusId: CAMPUS_ID,
        context: {
          actorName: "School Nurse",
          studentId: STUDENT_ID,
        },
      }),
      {},
    );
  });

  it("rejects missing checkedAt, future checkedAt, non-positive metrics, and empty meaningful values before loading student data", async () => {
    const useCase = new CreateStudentHealthCheckupUseCase(
      checkupRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        { heightCm: 100 } as never,
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          checkedAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          heightCm: 100,
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        { checkedAt: CHECKED_AT, weightKg: 0 },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        { checkedAt: CHECKED_AT, heightCm: "12abc" },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        { checkedAt: CHECKED_AT, notes: "   " },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(studentRepository.findById).not.toHaveBeenCalled();
    expect(checkupRepository.create).not.toHaveBeenCalled();
  });

  it("rejects archived-student writes", async () => {
    studentRepository.findById.mockResolvedValue(
      makeStudent({ isArchived: true }),
    );

    const useCase = new CreateStudentHealthCheckupUseCase(
      checkupRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        { checkedAt: CHECKED_AT, heightCm: 100 },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(checkupRepository.create).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("updates only allowed fields and keeps the meaningful-value rule after applying the payload", async () => {
    const checkup = makeCheckup({ heightCm: 100, weightKg: null, notes: null });
    studentRepository.findById.mockResolvedValue(makeStudent());
    checkupRepository.findByIdForStudentInCampus.mockResolvedValue(checkup);

    const useCase = new UpdateStudentHealthCheckupUseCase(
      checkupRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        CHECKUP_ID,
        { heightCm: null, notes: "  " },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(checkupRepository.update).not.toHaveBeenCalled();
  });

  it("PATCH rejects empty payloads and unknown fields before loading student data", async () => {
    const useCase = new UpdateStudentHealthCheckupUseCase(
      checkupRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(CAMPUS_ID, STUDENT_ID, CHECKUP_ID, {}, CURRENT_USER),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        CHECKUP_ID,
        { bmi: 12 } as never,
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(studentRepository.findById).not.toHaveBeenCalled();
  });
});
