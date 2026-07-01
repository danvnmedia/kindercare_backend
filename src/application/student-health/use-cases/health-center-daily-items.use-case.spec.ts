import { BadRequestException, NotFoundException } from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import {
  StudentHealthEventRepository,
  StudentHealthInstructionRepository,
} from "@/application/student-health";
import { Class } from "@/domain/class-management/entities/class.entity";
import {
  StudentHealthConditionCategory,
  StudentHealthEvent,
  StudentHealthEventStatus,
  StudentHealthEventType,
  StudentHealthInstruction,
  StudentHealthInstructionType,
} from "@/domain/student-health";

import { GetHealthCenterDailyItemsUseCase } from "./get-health-center-daily-items.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const STUDENT_ID = "33333333-3333-4333-a333-333333333333";
const CLASS_ID = "44444444-4444-4444-a444-444444444444";
const INSTRUCTION_ID = "55555555-5555-4555-a555-555555555555";
const EVENT_ID = "66666666-6666-4666-a666-666666666666";
const USER_ID = "77777777-7777-4777-a777-777777777777";

function makeClass(campusId = CAMPUS_ID) {
  return Class.create(
    {
      name: "Sunflower",
      description: null,
      campusId,
      gradeLevelId: "88888888-8888-4888-a888-888888888888",
      schoolYearId: "99999999-9999-4999-a999-999999999999",
    },
    CLASS_ID,
  );
}

function makeInstruction() {
  return StudentHealthInstruction.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      instructionType: StudentHealthInstructionType.MEDICATION,
      title: "Antibiotic after lunch",
      instruction: "Give after lunch with water.",
      dosage: "5 ml",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      timesOfDay: ["12:30"],
      scheduleNotes: "After lunch only.",
      notes: "Call guardian if vomiting occurs.",
      isActive: true,
      createdByUserId: USER_ID,
      createdBy: { id: USER_ID, fullName: "School Nurse" },
    },
    INSTRUCTION_ID,
  );
}

function makeEvent() {
  return StudentHealthEvent.create(
    {
      campusId: CAMPUS_ID,
      studentId: STUDENT_ID,
      eventType: StudentHealthEventType.ILLNESS,
      category: StudentHealthConditionCategory.EYE,
      title: "Eye redness observed",
      description: "Teacher noticed redness after nap time.",
      occurredAt: new Date("2026-06-30T15:00:00.000Z"),
      status: StudentHealthEventStatus.OPEN,
      resolutionNotes: null,
      recordedByUserId: USER_ID,
      recordedBy: { id: USER_ID, fullName: "Class Teacher" },
    },
    EVENT_ID,
  );
}

describe("GetHealthCenterDailyItemsUseCase", () => {
  let instructionRepository: jest.Mocked<StudentHealthInstructionRepository>;
  let eventRepository: jest.Mocked<StudentHealthEventRepository>;
  let classRepository: jest.Mocked<ClassRepository>;

  beforeEach(() => {
    instructionRepository = {
      findActiveForHealthCenter: jest.fn(),
    } as unknown as jest.Mocked<StudentHealthInstructionRepository>;
    eventRepository = {
      findOpenForHealthCenter: jest.fn(),
    } as unknown as jest.Mocked<StudentHealthEventRepository>;
    classRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClassRepository>;
  });

  it("returns grouped daily items with independent pagination and modal fields", async () => {
    classRepository.findById.mockResolvedValue(makeClass());
    instructionRepository.findActiveForHealthCenter.mockResolvedValue({
      total: 12,
      data: [
        {
          instruction: makeInstruction(),
          student: {
            id: STUDENT_ID,
            fullName: "Alice Student",
            avatarUrl: null,
          },
          class: { id: CLASS_ID, name: "Sunflower" },
        },
      ],
    });
    eventRepository.findOpenForHealthCenter.mockResolvedValue({
      total: 3,
      data: [
        {
          event: makeEvent(),
          student: {
            id: STUDENT_ID,
            fullName: "Alice Student",
            avatarUrl: null,
          },
          class: { id: CLASS_ID, name: "Sunflower" },
        },
      ],
    });

    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
    );

    const result = await useCase.execute({
      campusId: CAMPUS_ID,
      date: "2026-07-01",
      classId: CLASS_ID,
      instructions: { offset: 10, limit: 1 },
      events: { offset: 0, limit: 2 },
    });

    expect(classRepository.findById).toHaveBeenCalledWith(CLASS_ID);
    expect(
      instructionRepository.findActiveForHealthCenter,
    ).toHaveBeenCalledWith({
      campusId: CAMPUS_ID,
      referenceDate: new Date("2026-07-01T00:00:00.000Z"),
      classId: CLASS_ID,
      offset: 10,
      limit: 1,
    });
    expect(eventRepository.findOpenForHealthCenter).toHaveBeenCalledWith({
      campusId: CAMPUS_ID,
      referenceDate: new Date("2026-07-01T00:00:00.000Z"),
      classId: CLASS_ID,
      offset: 0,
      limit: 2,
    });
    expect(result).toMatchObject({
      campusId: CAMPUS_ID,
      date: "2026-07-01",
      classId: CLASS_ID,
      counts: { instructions: 12, events: 3, total: 15 },
      pagination: {
        instructions: { offset: 10, limit: 1, total: 12, hasMore: true },
        events: { offset: 0, limit: 2, total: 3, hasMore: true },
      },
      instructions: [
        {
          id: INSTRUCTION_ID,
          student: { id: STUDENT_ID, fullName: "Alice Student" },
          class: { id: CLASS_ID, name: "Sunflower" },
          status: "ACTIVE",
          notes: "Call guardian if vomiting occurs.",
          createdBy: { id: USER_ID, fullName: "School Nurse" },
        },
      ],
      events: [
        {
          id: EVENT_ID,
          student: { id: STUDENT_ID, fullName: "Alice Student" },
          class: { id: CLASS_ID, name: "Sunflower" },
          status: "OPEN",
          occurredAt: new Date("2026-06-30T15:00:00.000Z"),
          recordedBy: { id: USER_ID, fullName: "Class Teacher" },
        },
      ],
    });
  });

  it("defaults date and pagination when omitted", async () => {
    instructionRepository.findActiveForHealthCenter.mockResolvedValue({
      total: 0,
      data: [],
    });
    eventRepository.findOpenForHealthCenter.mockResolvedValue({
      total: 0,
      data: [],
    });

    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
    );

    const result = await useCase.execute({ campusId: CAMPUS_ID });

    expect(classRepository.findById).not.toHaveBeenCalled();
    expect(
      instructionRepository.findActiveForHealthCenter,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, limit: 50, classId: undefined }),
    );
    expect(eventRepository.findOpenForHealthCenter).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, limit: 50, classId: undefined }),
    );
    expect(result.classId).toBeNull();
    expect(result.instructions).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.counts).toEqual({ instructions: 0, events: 0, total: 0 });
  });

  it("rejects invalid dates before repository reads", async () => {
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
    );

    await expect(
      useCase.execute({ campusId: CAMPUS_ID, date: "07-01-2026" }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
  });

  it("rejects unknown or cross-campus class filters", async () => {
    classRepository.findById.mockResolvedValue(makeClass(OTHER_CAMPUS_ID));

    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
    );

    await expect(
      useCase.execute({
        campusId: CAMPUS_ID,
        classId: CLASS_ID,
        date: "2026-07-01",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
  });
});
