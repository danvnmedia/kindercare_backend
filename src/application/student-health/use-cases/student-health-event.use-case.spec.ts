import { readFileSync } from "fs";
import { join } from "path";

import { BadRequestException, NotFoundException } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentHealthEventRepository } from "@/application/student-health";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  StudentHealthConditionCategory,
  StudentHealthEvent,
  StudentHealthEventStatus,
  StudentHealthEventType,
} from "@/domain/student-health";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";

import { CreateStudentHealthEventUseCase } from "./create-student-health-event.use-case";
import { GetStudentHealthEventByIdUseCase } from "./get-student-health-event-by-id.use-case";
import { GetStudentHealthEventsUseCase } from "./get-student-health-events.use-case";
import { UpdateStudentHealthEventUseCase } from "./update-student-health-event.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const STUDENT_ID = "33333333-3333-4333-a333-333333333333";
const EVENT_ID = "44444444-4444-4444-a444-444444444444";
const ACTOR_ID = "55555555-5555-4555-a555-555555555555";
const OCCURRED_AT = new Date("2020-01-15T09:00:00.000Z");

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

function makeEvent(
  overrides: Partial<{
    status: StudentHealthEventStatus;
    title: string;
    resolutionNotes: string | null;
  }> = {},
) {
  return StudentHealthEvent.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      eventType: StudentHealthEventType.ILLNESS,
      category: StudentHealthConditionCategory.EYE,
      title: overrides.title ?? "Eye redness observed",
      description: "Teacher noticed redness after nap time.",
      occurredAt: OCCURRED_AT,
      status: overrides.status ?? StudentHealthEventStatus.OPEN,
      resolutionNotes: Object.prototype.hasOwnProperty.call(
        overrides,
        "resolutionNotes",
      )
        ? overrides.resolutionNotes
        : null,
      recordedByUserId: ACTOR_ID,
      recordedBy: { id: ACTOR_ID, fullName: "School Nurse" },
    },
    EVENT_ID,
  );
}

describe("Student health event use cases", () => {
  let eventRepository: jest.Mocked<StudentHealthEventRepository>;
  let studentRepository: jest.Mocked<StudentRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let auditRecorder: jest.Mocked<AuditEventRecorderPort>;

  beforeEach(() => {
    eventRepository = {
      findByStudentInCampus: jest.fn(),
      findByIdForStudentInCampus: jest.fn(),
      create: jest.fn(async (event) => event),
      update: jest.fn(async (event) => event),
    } as unknown as jest.Mocked<StudentHealthEventRepository>;
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

  it("lists events after campus student validation and passes status/type filters", async () => {
    const params = {
      status: StudentHealthEventStatus.OPEN,
      eventType: StudentHealthEventType.ILLNESS,
      limit: 10,
      offset: 0,
    };
    const result = { data: [makeEvent()], pagination: {} as never };
    studentRepository.findById.mockResolvedValue(makeStudent());
    eventRepository.findByStudentInCampus.mockResolvedValue(result);

    const useCase = new GetStudentHealthEventsUseCase(
      eventRepository,
      studentRepository,
    );

    await expect(
      useCase.execute({ campusId: CAMPUS_ID, studentId: STUDENT_ID, params }),
    ).resolves.toBe(result);
    expect(eventRepository.findByStudentInCampus).toHaveBeenCalledWith(
      CAMPUS_ID,
      STUDENT_ID,
      params,
    );
  });

  it("hides cross-campus students as not found", async () => {
    studentRepository.findById.mockResolvedValue(
      makeStudent({ campusId: OTHER_CAMPUS_ID }),
    );

    const useCase = new GetStudentHealthEventsUseCase(
      eventRepository,
      studentRepository,
    );

    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        params: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(eventRepository.findByStudentInCampus).not.toHaveBeenCalled();
  });

  it("reads archived-student events without blocking access", async () => {
    const event = makeEvent({ status: StudentHealthEventStatus.ARCHIVED });
    studentRepository.findById.mockResolvedValue(
      makeStudent({ isArchived: true }),
    );
    eventRepository.findByIdForStudentInCampus.mockResolvedValue(event);

    const useCase = new GetStudentHealthEventByIdUseCase(
      eventRepository,
      studentRepository,
    );

    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        eventId: EVENT_ID,
      }),
    ).resolves.toBe(event);
  });

  it("creates a manual event with normalized fields and mutation audit", async () => {
    studentRepository.findById.mockResolvedValue(makeStudent());

    const useCase = new CreateStudentHealthEventUseCase(
      eventRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    const result = await useCase.execute(
      CAMPUS_ID,
      STUDENT_ID,
      {
        eventType: StudentHealthEventType.ILLNESS,
        category: StudentHealthConditionCategory.EYE,
        title: "  Eye redness observed  ",
        description: "   ",
        occurredAt: OCCURRED_AT,
        status: StudentHealthEventStatus.OPEN,
        resolutionNotes: "  Follow up tomorrow.  ",
      },
      CURRENT_USER,
    );

    expect(result.title).toBe("Eye redness observed");
    expect(result.description).toBeNull();
    expect(result.resolutionNotes).toBe("Follow up tomorrow.");
    expect(eventRepository.create).toHaveBeenCalledWith(result, {});
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        action: "CREATE_STUDENT_HEALTH_EVENT",
        targetType: "student_health_event",
        campusId: CAMPUS_ID,
        context: {
          actorName: "School Nurse",
          studentId: STUDENT_ID,
        },
      }),
      {},
    );
  });

  it("rejects invalid create payloads before loading student data", async () => {
    const useCase = new CreateStudentHealthEventUseCase(
      eventRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          eventType: StudentHealthEventType.ILLNESS,
          title: "Eye redness observed",
          occurredAt: OCCURRED_AT,
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          eventType: StudentHealthEventType.ILLNESS,
          title: " ",
          occurredAt: OCCURRED_AT,
          status: StudentHealthEventStatus.OPEN,
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          eventType: "BAD_TYPE",
          title: "Eye redness observed",
          occurredAt: OCCURRED_AT,
          status: StudentHealthEventStatus.OPEN,
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          eventType: StudentHealthEventType.ILLNESS,
          category: "BAD_CATEGORY",
          title: "Eye redness observed",
          occurredAt: OCCURRED_AT,
          status: StudentHealthEventStatus.OPEN,
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          eventType: StudentHealthEventType.ILLNESS,
          title: "Eye redness observed",
          occurredAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: StudentHealthEventStatus.OPEN,
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(studentRepository.findById).not.toHaveBeenCalled();
    expect(eventRepository.create).not.toHaveBeenCalled();
  });

  it("rejects archived-student writes", async () => {
    studentRepository.findById.mockResolvedValue(
      makeStudent({ isArchived: true }),
    );

    const useCase = new CreateStudentHealthEventUseCase(
      eventRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        {
          eventType: StudentHealthEventType.ILLNESS,
          title: "Eye redness observed",
          occurredAt: OCCURRED_AT,
          status: StudentHealthEventStatus.OPEN,
        },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(eventRepository.create).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("rejects archived-student event updates", async () => {
    studentRepository.findById.mockResolvedValue(
      makeStudent({ isArchived: true }),
    );

    const useCase = new UpdateStudentHealthEventUseCase(
      eventRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        EVENT_ID,
        { status: StudentHealthEventStatus.RESOLVED },
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(eventRepository.findByIdForStudentInCampus).not.toHaveBeenCalled();
    expect(eventRepository.update).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("updates status to ARCHIVED as a readable non-delete state and audits diffs", async () => {
    const event = makeEvent();
    studentRepository.findById.mockResolvedValue(makeStudent());
    eventRepository.findByIdForStudentInCampus.mockResolvedValue(event);

    const useCase = new UpdateStudentHealthEventUseCase(
      eventRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    const result = await useCase.execute(
      CAMPUS_ID,
      STUDENT_ID,
      EVENT_ID,
      {
        status: StudentHealthEventStatus.ARCHIVED,
        resolutionNotes: "  Archived after review.  ",
      },
      CURRENT_USER,
    );

    expect(result.status).toBe(StudentHealthEventStatus.ARCHIVED);
    expect(result.resolutionNotes).toBe("Archived after review.");
    expect(eventRepository.update).toHaveBeenCalledWith(event, {});
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UPDATE_STUDENT_HEALTH_EVENT",
        beforeValue: expect.objectContaining({
          status: StudentHealthEventStatus.OPEN,
        }),
        afterValue: expect.objectContaining({
          status: StudentHealthEventStatus.ARCHIVED,
        }),
      }),
      {},
    );
  });

  it("PATCH rejects empty payloads and unknown fields before loading student data", async () => {
    const useCase = new UpdateStudentHealthEventUseCase(
      eventRepository,
      studentRepository,
      transactionRunner,
      auditRecorder,
    );

    await expect(
      useCase.execute(CAMPUS_ID, STUDENT_ID, EVENT_ID, {}, CURRENT_USER),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      useCase.execute(
        CAMPUS_ID,
        STUDENT_ID,
        EVENT_ID,
        { deletedAt: new Date() } as never,
        CURRENT_USER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(studentRepository.findById).not.toHaveBeenCalled();
  });
});

describe("Student health events are manual-only in V1", () => {
  const mutationUseCases = [
    "create-student-health-checkup.use-case.ts",
    "update-student-health-checkup.use-case.ts",
    "create-student-health-instruction.use-case.ts",
    "update-student-health-instruction.use-case.ts",
    "update-student-health-profile.use-case.ts",
  ];

  it("does not auto-generate events from profile, checkup, or instruction mutations", () => {
    for (const fileName of mutationUseCases) {
      const source = readFileSync(join(__dirname, fileName), "utf8");

      expect(source).not.toContain("STUDENT_HEALTH_EVENT_REPOSITORY");
      expect(source).not.toContain("CREATE_STUDENT_HEALTH_EVENT");
      expect(source).not.toContain("StudentHealthEvent");
    }
  });
});
