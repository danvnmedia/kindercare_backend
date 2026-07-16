import { BadRequestException, NotFoundException } from "@nestjs/common";

import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import {
  MedicationAdministrationQueueRow,
  MedicationAdministrationRepository,
  MedicationRequestRepository,
} from "@/application/medication";
import {
  StudentHealthEventRepository,
  StudentHealthInstructionRepository,
} from "@/application/student-health";
import { Class } from "@/domain/class-management/entities/class.entity";
import {
  MedicationAdministrationOccurrence,
  MedicationAdministrationStatus,
} from "@/domain/medication";
import {
  StudentHealthConditionCategory,
  StudentHealthEvent,
  StudentHealthEventStatus,
  StudentHealthEventType,
  StudentHealthInstruction,
  StudentHealthInstructionType,
} from "@/domain/student-health";
import {
  createCampus,
  createMockCampusRepository,
  createPermission,
  createRole,
  createRoleAssignment,
  createUser,
} from "@/test-utils";

import { GetHealthCenterDailyItemsUseCase } from "./get-health-center-daily-items.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";
const STUDENT_ID = "33333333-3333-4333-a333-333333333333";
const CLASS_ID = "44444444-4444-4444-a444-444444444444";
const INSTRUCTION_ID = "55555555-5555-4555-a555-555555555555";
const EVENT_ID = "66666666-6666-4666-a666-666666666666";
const USER_ID = "77777777-7777-4777-a777-777777777777";
const OCCURRENCE_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const REQUEST_ID = "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb";
const MEDICATION_ITEM_ID = "cccccccc-cccc-4ccc-accc-cccccccccccc";

function makeUserWithPermissions(...permissionIds: string[]) {
  const role = createRole({
    permissions: permissionIds.map((id) =>
      createPermission({
        id,
        module: id.split(".")[0],
      }),
    ),
  });

  return createUser({
    roleAssignments: [createRoleAssignment(role, CAMPUS_ID)],
  });
}

function makeHealthReader() {
  return makeUserWithPermissions("student_health.read");
}

function makeGlobalSystemUser() {
  return createUser({
    roleAssignments: [
      createRoleAssignment(
        createRole({ isSystemRole: true, campusId: null }),
        null,
      ),
    ],
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

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

function makeMedicationQueueRow(): MedicationAdministrationQueueRow {
  return {
    occurrence: MedicationAdministrationOccurrence.create(
      {
        campusId: CAMPUS_ID,
        studentId: STUDENT_ID,
        requestId: REQUEST_ID,
        medicationItemId: MEDICATION_ITEM_ID,
        dueDate: "2026-07-01",
        dueMinute: 600,
      },
      OCCURRENCE_ID,
    ),
    request: {
      id: REQUEST_ID,
      parentNotes: null,
    },
    medicationItem: {
      id: MEDICATION_ITEM_ID,
      medicationName: "Amoxicillin",
      dosage: null,
      instructions: "Give with water.",
    },
    student: {
      id: STUDENT_ID,
      fullName: "Alice Student",
      studentCode: null,
    },
    class: null,
    latestLog: null,
  };
}

describe("GetHealthCenterDailyItemsUseCase", () => {
  let instructionRepository: jest.Mocked<StudentHealthInstructionRepository>;
  let eventRepository: jest.Mocked<StudentHealthEventRepository>;
  let classRepository: jest.Mocked<ClassRepository>;
  let campusRepository: jest.Mocked<CampusRepository>;
  let medicationAdministrationRepository: jest.Mocked<MedicationAdministrationRepository>;
  let medicationRequestRepository: jest.Mocked<MedicationRequestRepository>;

  beforeEach(() => {
    instructionRepository = {
      findActiveForHealthCenter: jest.fn(),
      countActiveForHealthCenter: jest.fn(),
    } as unknown as jest.Mocked<StudentHealthInstructionRepository>;
    eventRepository = {
      findOpenForHealthCenter: jest.fn(),
      countOpenForHealthCenter: jest.fn(),
    } as unknown as jest.Mocked<StudentHealthEventRepository>;
    classRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClassRepository>;
    campusRepository = createMockCampusRepository();
    campusRepository.findById.mockResolvedValue(
      createCampus({ id: CAMPUS_ID, timeZone: "America/Toronto" }),
    );
    medicationAdministrationRepository = {
      findHealthCenterDailyByCampus: jest.fn().mockResolvedValue([]),
      countHealthCenterSummaryByCampus: jest
        .fn()
        .mockResolvedValue({ dueToday: 0, overdue: 0 }),
    } as unknown as jest.Mocked<MedicationAdministrationRepository>;
    medicationRequestRepository = {
      countHealthCenterRequestsNeedingReview: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<MedicationRequestRepository>;
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
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        date: "2026-07-01",
        classId: CLASS_ID,
        instructions: { offset: 10, limit: 1 },
        events: { offset: 0, limit: 2 },
        medications: { offset: 5, limit: 10 },
      },
      makeHealthReader(),
      new Date("2026-07-01T15:30:00.000Z"),
    );

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
      visibleUntil: new Date("2026-07-01T15:30:00.000Z"),
      classId: CLASS_ID,
      offset: 0,
      limit: 2,
    });
    expect(
      medicationAdministrationRepository.findHealthCenterDailyByCampus,
    ).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).not.toHaveBeenCalled();
    expect(
      medicationRequestRepository.countHealthCenterRequestsNeedingReview,
    ).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      campusId: CAMPUS_ID,
      date: "2026-07-01",
      classId: CLASS_ID,
      generatedAt: "2026-07-01T15:30:00.000Z",
      access: {
        healthItems: true,
        medicationAdministrations: false,
        medicationRequests: false,
        canRecordMedication: false,
        canReviewMedicationRequests: false,
      },
      counts: {
        instructions: 12,
        events: 3,
        total: 15,
        medicationAdministrations: 0,
        dueMedicationAdministrations: 0,
        overdueMedicationAdministrations: 0,
        requestsNeedingReview: 0,
        visibleTotal: 15,
        actionRequired: 0,
      },
      pagination: {
        instructions: { offset: 10, limit: 1, total: 12, hasMore: true },
        events: { offset: 0, limit: 2, total: 3, hasMore: true },
        medicationAdministrations: {
          offset: 5,
          limit: 10,
          total: 0,
          hasMore: false,
        },
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
      medicationAdministrations: [],
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
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    const result = await useCase.execute(
      { campusId: CAMPUS_ID },
      makeHealthReader(),
      new Date("2026-07-02T02:30:00.000Z"),
    );

    expect(classRepository.findById).not.toHaveBeenCalled();
    expect(
      instructionRepository.findActiveForHealthCenter,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, limit: 50, classId: undefined }),
    );
    expect(eventRepository.findOpenForHealthCenter).toHaveBeenCalledWith(
      expect.objectContaining({
        offset: 0,
        limit: 50,
        classId: undefined,
        visibleUntil: new Date("2026-07-02T02:30:00.000Z"),
      }),
    );
    expect(result.classId).toBeNull();
    expect(result.date).toBe("2026-07-01");
    expect(result.instructions).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.counts).toEqual({
      instructions: 0,
      events: 0,
      total: 0,
      medicationAdministrations: 0,
      dueMedicationAdministrations: 0,
      overdueMedicationAdministrations: 0,
      requestsNeedingReview: 0,
      visibleTotal: 0,
      actionRequired: 0,
    });
  });

  it("rejects invalid dates before repository reads", async () => {
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    await expect(
      useCase.execute(
        { campusId: CAMPUS_ID, date: "07-01-2026" },
        makeHealthReader(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
    expect(
      medicationRequestRepository.countHealthCenterRequestsNeedingReview,
    ).not.toHaveBeenCalled();
  });

  it("rejects a missing campus before class or section reads", async () => {
    campusRepository.findById.mockResolvedValue(null);
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    await expect(
      useCase.execute(
        { campusId: CAMPUS_ID, classId: CLASS_ID },
        makeGlobalSystemUser(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(classRepository.findById).not.toHaveBeenCalled();
    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.findHealthCenterDailyByCampus,
    ).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).not.toHaveBeenCalled();
    expect(
      medicationRequestRepository.countHealthCenterRequestsNeedingReview,
    ).not.toHaveBeenCalled();
  });

  it("rejects unknown or cross-campus class filters", async () => {
    classRepository.findById.mockResolvedValue(makeClass(OTHER_CAMPUS_ID));

    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    await expect(
      useCase.execute(
        {
          campusId: CAMPUS_ID,
          classId: CLASS_ID,
          date: "2026-07-01",
        },
        makeHealthReader(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.findHealthCenterDailyByCampus,
    ).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).not.toHaveBeenCalled();
    expect(
      medicationRequestRepository.countHealthCenterRequestsNeedingReview,
    ).not.toHaveBeenCalled();
  });

  it("uses count-only health queries for summaryOnly without hydrating rows", async () => {
    instructionRepository.countActiveForHealthCenter.mockResolvedValue(12);
    eventRepository.countOpenForHealthCenter.mockResolvedValue(3);
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );
    const now = new Date("2026-07-01T15:30:00.000Z");

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        date: "2026-07-01",
        summaryOnly: true,
      },
      makeHealthReader(),
      now,
    );

    expect(
      instructionRepository.countActiveForHealthCenter,
    ).toHaveBeenCalledWith({
      campusId: CAMPUS_ID,
      referenceDate: new Date("2026-07-01T00:00:00.000Z"),
      classId: undefined,
    });
    expect(eventRepository.countOpenForHealthCenter).toHaveBeenCalledWith({
      campusId: CAMPUS_ID,
      referenceDate: new Date("2026-07-01T00:00:00.000Z"),
      visibleUntil: now,
      classId: undefined,
    });
    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
    expect(result.instructions).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.counts).toMatchObject({
      instructions: 12,
      events: 3,
      total: 15,
      visibleTotal: 15,
    });
  });

  it("does not invoke health repositories without student_health.read", async () => {
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    const result = await useCase.execute(
      { campusId: CAMPUS_ID, date: "2026-07-01" },
      makeUserWithPermissions("medication_administration.read"),
      new Date("2026-07-01T15:30:00.000Z"),
    );

    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(
      instructionRepository.countActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
    expect(eventRepository.countOpenForHealthCenter).not.toHaveBeenCalled();
    expect(result.access.healthItems).toBe(false);
    expect(result.instructions).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.counts).toMatchObject({
      instructions: 0,
      events: 0,
      total: 0,
      visibleTotal: 0,
    });
  });

  it("returns medication work to an administration reader without making it actionable for update alone", async () => {
    medicationAdministrationRepository.findHealthCenterDailyByCampus.mockResolvedValue(
      [makeMedicationQueueRow()],
    );
    medicationAdministrationRepository.countHealthCenterSummaryByCampus.mockResolvedValue(
      { dueToday: 1, overdue: 2 },
    );
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );
    const now = new Date("2026-07-01T15:30:00.000Z");

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        date: "2026-07-01",
        medications: { offset: 1, limit: 2 },
      },
      makeUserWithPermissions(
        "medication_administration.read",
        "medication_administration.update",
      ),
      now,
    );

    expect(
      medicationAdministrationRepository.findHealthCenterDailyByCampus,
    ).toHaveBeenCalledWith(CAMPUS_ID, {
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
      now,
      timeZone: "America/Toronto",
      classId: undefined,
      offset: 1,
      limit: 2,
    });
    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).toHaveBeenCalledWith(CAMPUS_ID, {
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
      now,
      timeZone: "America/Toronto",
      classId: undefined,
    });
    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
    expect(result.access).toMatchObject({
      medicationAdministrations: true,
      canRecordMedication: false,
    });
    expect(result.counts).toMatchObject({
      medicationAdministrations: 3,
      dueMedicationAdministrations: 1,
      overdueMedicationAdministrations: 2,
      visibleTotal: 3,
      actionRequired: 0,
    });
    expect(result.pagination.medicationAdministrations).toEqual({
      offset: 1,
      limit: 2,
      total: 3,
      hasMore: false,
    });
    expect(result.medicationAdministrations).toEqual([
      expect.objectContaining({
        occurrenceId: OCCURRENCE_ID,
        requestId: REQUEST_ID,
        student: expect.objectContaining({ id: STUDENT_ID }),
        status: MedicationAdministrationStatus.OVERDUE,
        isOverdue: true,
        latestLog: null,
      }),
    ]);
  });

  it("uses only medication counts for summaryOnly and gates action counts on create", async () => {
    medicationAdministrationRepository.countHealthCenterSummaryByCampus.mockResolvedValue(
      { dueToday: 4, overdue: 2 },
    );
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        date: "2026-07-01",
        summaryOnly: true,
      },
      makeUserWithPermissions(
        "medication_administration.read",
        "medication_administration.create",
      ),
      new Date("2026-07-01T15:30:00.000Z"),
    );

    expect(
      medicationAdministrationRepository.findHealthCenterDailyByCampus,
    ).not.toHaveBeenCalled();
    expect(result.medicationAdministrations).toEqual([]);
    expect(result.counts).toMatchObject({
      medicationAdministrations: 6,
      dueMedicationAdministrations: 4,
      overdueMedicationAdministrations: 2,
      actionRequired: 6,
    });
  });

  it("returns the request review count with list permission but does not make it actionable", async () => {
    medicationRequestRepository.countHealthCenterRequestsNeedingReview.mockResolvedValue(
      5,
    );
    classRepository.findById.mockResolvedValue(makeClass());
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );
    const now = new Date("2026-07-02T02:30:00.000Z");

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        date: "2026-06-15",
        classId: CLASS_ID,
      },
      makeUserWithPermissions("medication_request.list"),
      now,
    );

    expect(
      medicationRequestRepository.countHealthCenterRequestsNeedingReview,
    ).toHaveBeenCalledWith(CAMPUS_ID, {
      actualDate: new Date("2026-07-01T00:00:00.000Z"),
      enrollmentReferenceDate: new Date("2026-06-15T00:00:00.000Z"),
      classId: CLASS_ID,
    });
    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.findHealthCenterDailyByCampus,
    ).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).not.toHaveBeenCalled();
    expect(result.access).toMatchObject({
      medicationRequests: true,
      canReviewMedicationRequests: false,
    });
    expect(result.counts).toMatchObject({
      requestsNeedingReview: 5,
      visibleTotal: 0,
      actionRequired: 0,
    });
  });

  it("adds request review work to actionRequired only with list, read, and update", async () => {
    medicationRequestRepository.countHealthCenterRequestsNeedingReview.mockResolvedValue(
      5,
    );
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    const result = await useCase.execute(
      { campusId: CAMPUS_ID, date: "2026-07-01" },
      makeUserWithPermissions(
        "medication_request.list",
        "medication_request.read",
        "medication_request.update",
      ),
      new Date("2026-07-01T15:30:00.000Z"),
    );

    expect(result.access.canReviewMedicationRequests).toBe(true);
    expect(result.counts).toMatchObject({
      requestsNeedingReview: 5,
      visibleTotal: 0,
      actionRequired: 5,
    });
  });

  it("composes every authorized hydrated section with legacy and unified totals", async () => {
    instructionRepository.findActiveForHealthCenter.mockResolvedValue({
      total: 1,
      data: [
        {
          instruction: makeInstruction(),
          student: {
            id: STUDENT_ID,
            fullName: "Alice Student",
            avatarUrl: null,
          },
          class: null,
        },
      ],
    });
    eventRepository.findOpenForHealthCenter.mockResolvedValue({
      total: 1,
      data: [
        {
          event: makeEvent(),
          student: {
            id: STUDENT_ID,
            fullName: "Alice Student",
            avatarUrl: null,
          },
          class: null,
        },
      ],
    });
    medicationAdministrationRepository.findHealthCenterDailyByCampus.mockResolvedValue(
      [makeMedicationQueueRow()],
    );
    medicationAdministrationRepository.countHealthCenterSummaryByCampus.mockResolvedValue(
      { dueToday: 0, overdue: 1 },
    );
    medicationRequestRepository.countHealthCenterRequestsNeedingReview.mockResolvedValue(
      2,
    );
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    const result = await useCase.execute(
      { campusId: CAMPUS_ID, date: "2026-07-01" },
      makeUserWithPermissions(
        "student_health.read",
        "medication_administration.read",
        "medication_administration.create",
        "medication_request.list",
        "medication_request.read",
        "medication_request.update",
      ),
      new Date("2026-07-01T15:30:00.000Z"),
    );

    expect(result.access).toEqual({
      healthItems: true,
      medicationAdministrations: true,
      medicationRequests: true,
      canRecordMedication: true,
      canReviewMedicationRequests: true,
    });
    expect(result.instructions).toHaveLength(1);
    expect(result.events).toHaveLength(1);
    expect(result.medicationAdministrations).toHaveLength(1);
    expect(result.counts).toEqual({
      instructions: 1,
      events: 1,
      total: 2,
      medicationAdministrations: 1,
      dueMedicationAdministrations: 0,
      overdueMedicationAdministrations: 1,
      requestsNeedingReview: 2,
      visibleTotal: 3,
      actionRequired: 3,
    });
  });

  it("runs authorized summary counts concurrently and uses page-window hasMore", async () => {
    const instructionCount = deferred<number>();
    const eventCount = deferred<number>();
    const medicationCounts = deferred<{ dueToday: number; overdue: number }>();
    const requestCount = deferred<number>();
    instructionRepository.countActiveForHealthCenter.mockReturnValue(
      instructionCount.promise,
    );
    eventRepository.countOpenForHealthCenter.mockReturnValue(
      eventCount.promise,
    );
    medicationAdministrationRepository.countHealthCenterSummaryByCampus.mockReturnValue(
      medicationCounts.promise,
    );
    medicationRequestRepository.countHealthCenterRequestsNeedingReview.mockReturnValue(
      requestCount.promise,
    );
    classRepository.findById.mockResolvedValue(makeClass());
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );
    const now = new Date("2026-07-01T15:30:00.000Z");

    const execution = useCase.execute(
      {
        campusId: CAMPUS_ID,
        date: "2026-06-15",
        classId: CLASS_ID,
        summaryOnly: true,
        instructions: { offset: 10, limit: 1 },
        events: { offset: 2, limit: 2 },
        medications: { offset: 4, limit: 1 },
      },
      makeUserWithPermissions(
        "student_health.read",
        "medication_administration.read",
        "medication_administration.create",
        "medication_request.list",
        "medication_request.read",
        "medication_request.update",
      ),
      now,
    );

    for (let index = 0; index < 4; index += 1) {
      await Promise.resolve();
    }
    expect(
      instructionRepository.countActiveForHealthCenter,
    ).toHaveBeenCalledTimes(1);
    expect(eventRepository.countOpenForHealthCenter).toHaveBeenCalledTimes(1);
    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).toHaveBeenCalledTimes(1);
    expect(
      medicationRequestRepository.countHealthCenterRequestsNeedingReview,
    ).toHaveBeenCalledTimes(1);
    expect(
      instructionRepository.findActiveForHealthCenter,
    ).not.toHaveBeenCalled();
    expect(eventRepository.findOpenForHealthCenter).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.findHealthCenterDailyByCampus,
    ).not.toHaveBeenCalled();

    instructionCount.resolve(12);
    eventCount.resolve(3);
    medicationCounts.resolve({ dueToday: 4, overdue: 2 });
    requestCount.resolve(5);
    const result = await execution;

    expect(result.generatedAt).toBe(now.toISOString());
    expect(result.date).toBe("2026-06-15");
    expect(result.classId).toBe(CLASS_ID);
    expect(result.instructions).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.medicationAdministrations).toEqual([]);
    expect(result.counts).toEqual({
      instructions: 12,
      events: 3,
      total: 15,
      medicationAdministrations: 6,
      dueMedicationAdministrations: 4,
      overdueMedicationAdministrations: 2,
      requestsNeedingReview: 5,
      visibleTotal: 21,
      actionRequired: 11,
    });
    expect(result.pagination).toEqual({
      instructions: { offset: 10, limit: 1, total: 12, hasMore: true },
      events: { offset: 2, limit: 2, total: 3, hasMore: false },
      medicationAdministrations: {
        offset: 4,
        limit: 1,
        total: 6,
        hasMore: true,
      },
    });
  });

  it("grants all unified capabilities to a global system-role user", async () => {
    instructionRepository.countActiveForHealthCenter.mockResolvedValue(0);
    eventRepository.countOpenForHealthCenter.mockResolvedValue(0);
    medicationAdministrationRepository.countHealthCenterSummaryByCampus.mockResolvedValue(
      { dueToday: 1, overdue: 1 },
    );
    medicationRequestRepository.countHealthCenterRequestsNeedingReview.mockResolvedValue(
      1,
    );
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        date: "2026-07-01",
        summaryOnly: true,
      },
      makeGlobalSystemUser(),
      new Date("2026-07-01T15:30:00.000Z"),
    );

    expect(result.access).toEqual({
      healthItems: true,
      medicationAdministrations: true,
      medicationRequests: true,
      canRecordMedication: true,
      canReviewMedicationRequests: true,
    });
    expect(result.counts.actionRequired).toBe(3);
  });

  it("fails the whole request when an authorized domain query fails", async () => {
    instructionRepository.findActiveForHealthCenter.mockResolvedValue({
      data: [],
      total: 0,
    });
    eventRepository.findOpenForHealthCenter.mockRejectedValue(
      new Error("event query failed"),
    );
    const useCase = new GetHealthCenterDailyItemsUseCase(
      instructionRepository,
      eventRepository,
      classRepository,
      campusRepository,
      medicationAdministrationRepository,
      medicationRequestRepository,
    );

    await expect(
      useCase.execute(
        { campusId: CAMPUS_ID, date: "2026-07-01" },
        makeHealthReader(),
        new Date("2026-07-01T15:30:00.000Z"),
      ),
    ).rejects.toThrow("event query failed");
  });
});
