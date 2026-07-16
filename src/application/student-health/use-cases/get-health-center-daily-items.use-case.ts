import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import {
  mapQueueRowToItem,
  MedicationAdministrationQueueItem,
  MedicationAdministrationQueueRow,
  MedicationAdministrationRepository,
  MedicationRequestRepository,
} from "@/application/medication";
import {
  getPermissionIdsForCampus,
  hasAllPermissions,
} from "@/application/rbac/permission-access";
import {
  HealthCenterEventItem,
  HealthCenterInstructionItem,
  StudentHealthEventRepository,
  StudentHealthInstructionRepository,
} from "@/application/student-health/ports";
import {
  getCampusDateOnly,
  getCampusDateString,
} from "@/core/time/campus-time-zone";
import {
  StudentHealthEventStatus,
  StudentHealthInstructionStatus,
} from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import { parseReferenceDate } from "./get-active-student-health-instructions.use-case";

export interface HealthCenterPaginationInput {
  offset?: number;
  limit?: number;
}

export interface GetHealthCenterDailyItemsInput {
  campusId: string;
  date?: string;
  classId?: string;
  instructions?: HealthCenterPaginationInput;
  events?: HealthCenterPaginationInput;
  medications?: HealthCenterPaginationInput;
  summaryOnly?: boolean;
}

export interface HealthCenterDailyStudentSummary {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface HealthCenterDailyClassSummary {
  id: string;
  name: string;
}

export interface HealthCenterUserSummary {
  id: string;
  fullName: string | null;
}

export interface HealthCenterInstructionResponseItem {
  id: string;
  studentId: string;
  campusId: string;
  student: HealthCenterDailyStudentSummary;
  class: HealthCenterDailyClassSummary | null;
  instructionType: HealthCenterInstructionItem["instruction"]["instructionType"];
  title: string;
  instruction: string;
  dosage: string | null;
  startDate: Date;
  endDate: Date | null;
  timesOfDay: string[];
  scheduleNotes: string | null;
  notes: string | null;
  isActive: boolean;
  status: StudentHealthInstructionStatus.ACTIVE;
  createdBy: HealthCenterUserSummary | null;
  lastUpdatedBy: HealthCenterUserSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthCenterEventResponseItem {
  id: string;
  studentId: string;
  campusId: string;
  student: HealthCenterDailyStudentSummary;
  class: HealthCenterDailyClassSummary | null;
  eventType: HealthCenterEventItem["event"]["eventType"];
  category: HealthCenterEventItem["event"]["category"];
  title: string;
  description: string | null;
  occurredAt: Date;
  status: StudentHealthEventStatus.OPEN;
  resolutionNotes: string | null;
  recordedBy: HealthCenterUserSummary | null;
  lastUpdatedBy: HealthCenterUserSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HealthCenterDailyItemsCounts {
  instructions: number;
  events: number;
  total: number;
  medicationAdministrations: number;
  dueMedicationAdministrations: number;
  overdueMedicationAdministrations: number;
  requestsNeedingReview: number;
  visibleTotal: number;
  actionRequired: number;
}

export interface HealthCenterDailyItemsPaginationGroup {
  offset: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface HealthCenterDailyItemsPagination {
  instructions: HealthCenterDailyItemsPaginationGroup;
  events: HealthCenterDailyItemsPaginationGroup;
  medicationAdministrations: HealthCenterDailyItemsPaginationGroup;
}

export interface HealthCenterDailyItemsAccess {
  healthItems: boolean;
  medicationAdministrations: boolean;
  medicationRequests: boolean;
  canRecordMedication: boolean;
  canReviewMedicationRequests: boolean;
}

export interface HealthCenterDailyItemsResponse {
  campusId: string;
  date: string;
  classId: string | null;
  generatedAt: string;
  access: HealthCenterDailyItemsAccess;
  counts: HealthCenterDailyItemsCounts;
  pagination: HealthCenterDailyItemsPagination;
  instructions: HealthCenterInstructionResponseItem[];
  events: HealthCenterEventResponseItem[];
  medicationAdministrations: MedicationAdministrationQueueItem[];
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class GetHealthCenterDailyItemsUseCase {
  constructor(
    @Inject("STUDENT_HEALTH_INSTRUCTION_REPOSITORY")
    private readonly instructionRepository: StudentHealthInstructionRepository,
    @Inject("STUDENT_HEALTH_EVENT_REPOSITORY")
    private readonly eventRepository: StudentHealthEventRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
    @Inject("MEDICATION_ADMINISTRATION_REPOSITORY")
    private readonly medicationAdministrationRepository: MedicationAdministrationRepository,
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
  ) {}

  async execute(
    input: GetHealthCenterDailyItemsInput,
    currentUser: User,
    now = new Date(),
  ): Promise<HealthCenterDailyItemsResponse> {
    const campus = await this.campusRepository.findById(input.campusId);
    if (!campus) {
      throw new NotFoundException("Campus not found");
    }

    const referenceDate = parseReferenceDate(
      input.date ?? getCampusDateString(now, campus.timeZone),
    );
    const classId = input.classId?.trim() || undefined;

    if (classId) {
      const classEntity = await this.classRepository.findById(classId);
      if (!classEntity || classEntity.campusId !== input.campusId) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }
    }

    const instructionsPagination = normalizePagination(input.instructions);
    const eventsPagination = normalizePagination(input.events);
    const medicationsPagination = normalizePagination(input.medications);
    const access = resolveAccess(currentUser, input.campusId);

    const instructionScope = {
      campusId: input.campusId,
      referenceDate,
      classId,
    };
    const eventScope = {
      campusId: input.campusId,
      referenceDate,
      visibleUntil: now,
      classId,
    };
    const medicationScope = {
      dueDate: referenceDate,
      now,
      timeZone: campus.timeZone,
      classId,
    };
    const requestReviewScope = {
      actualDate: getCampusDateOnly(now, campus.timeZone),
      enrollmentReferenceDate: referenceDate,
      classId,
    };

    const instructionsPromise = !access.healthItems
      ? Promise.resolve({
          data: [] as HealthCenterInstructionItem[],
          total: 0,
        })
      : input.summaryOnly
        ? this.instructionRepository
            .countActiveForHealthCenter(instructionScope)
            .then((total) => ({
              data: [] as HealthCenterInstructionItem[],
              total,
            }))
        : this.instructionRepository.findActiveForHealthCenter({
            ...instructionScope,
            offset: instructionsPagination.offset,
            limit: instructionsPagination.limit,
          });

    const eventsPromise = !access.healthItems
      ? Promise.resolve({
          data: [] as HealthCenterEventItem[],
          total: 0,
        })
      : input.summaryOnly
        ? this.eventRepository
            .countOpenForHealthCenter(eventScope)
            .then((total) => ({
              data: [] as HealthCenterEventItem[],
              total,
            }))
        : this.eventRepository.findOpenForHealthCenter({
            ...eventScope,
            offset: eventsPagination.offset,
            limit: eventsPagination.limit,
          });

    const medicationAdministrationsPromise = !access.medicationAdministrations
      ? Promise.resolve({
          rows: [] as MedicationAdministrationQueueRow[],
          dueToday: 0,
          overdue: 0,
        })
      : Promise.all([
          input.summaryOnly
            ? Promise.resolve([] as MedicationAdministrationQueueRow[])
            : this.medicationAdministrationRepository.findHealthCenterDailyByCampus(
                input.campusId,
                {
                  ...medicationScope,
                  offset: medicationsPagination.offset,
                  limit: medicationsPagination.limit,
                },
              ),
          this.medicationAdministrationRepository.countHealthCenterSummaryByCampus(
            input.campusId,
            medicationScope,
          ),
        ]).then(([rows, counts]) => ({ rows, ...counts }));

    const requestsNeedingReviewPromise = access.medicationRequests
      ? this.medicationRequestRepository.countHealthCenterRequestsNeedingReview(
          input.campusId,
          requestReviewScope,
        )
      : Promise.resolve(0);

    const [
      instructions,
      events,
      medicationAdministrations,
      requestsNeedingReview,
    ] = await Promise.all([
      instructionsPromise,
      eventsPromise,
      medicationAdministrationsPromise,
      requestsNeedingReviewPromise,
    ]);
    const medicationAdministrationTotal =
      medicationAdministrations.dueToday + medicationAdministrations.overdue;

    return {
      campusId: input.campusId,
      date: referenceDate.toISOString().slice(0, 10),
      classId: classId ?? null,
      generatedAt: now.toISOString(),
      access,
      counts: {
        instructions: instructions.total,
        events: events.total,
        total: instructions.total + events.total,
        medicationAdministrations: medicationAdministrationTotal,
        dueMedicationAdministrations: medicationAdministrations.dueToday,
        overdueMedicationAdministrations: medicationAdministrations.overdue,
        requestsNeedingReview,
        visibleTotal:
          instructions.total + events.total + medicationAdministrationTotal,
        actionRequired:
          (access.canRecordMedication ? medicationAdministrationTotal : 0) +
          (access.canReviewMedicationRequests ? requestsNeedingReview : 0),
      },
      pagination: {
        instructions: {
          ...instructionsPagination,
          total: instructions.total,
          hasMore: hasMorePage(instructionsPagination, instructions.total),
        },
        events: {
          ...eventsPagination,
          total: events.total,
          hasMore: hasMorePage(eventsPagination, events.total),
        },
        medicationAdministrations: {
          ...medicationsPagination,
          total: medicationAdministrationTotal,
          hasMore: hasMorePage(
            medicationsPagination,
            medicationAdministrationTotal,
          ),
        },
      },
      instructions: input.summaryOnly
        ? []
        : instructions.data.map((item) => toInstructionResponseItem(item)),
      events: input.summaryOnly
        ? []
        : events.data.map((item) => toEventResponseItem(item)),
      medicationAdministrations: input.summaryOnly
        ? []
        : medicationAdministrations.rows.map((row) =>
            mapQueueRowToItem(row, now, campus.timeZone),
          ),
    };
  }
}

function resolveAccess(
  currentUser: User,
  campusId: string,
): HealthCenterDailyItemsAccess {
  if (currentUser.hasSystemRole()) {
    return {
      healthItems: true,
      medicationAdministrations: true,
      medicationRequests: true,
      canRecordMedication: true,
      canReviewMedicationRequests: true,
    };
  }

  const permissionIds = getPermissionIdsForCampus(currentUser, campusId);
  const healthItems = permissionIds.has("student_health.read");
  const medicationAdministrations = permissionIds.has(
    "medication_administration.read",
  );
  const medicationRequests = permissionIds.has("medication_request.list");

  return {
    healthItems,
    medicationAdministrations,
    medicationRequests,
    canRecordMedication:
      medicationAdministrations &&
      permissionIds.has("medication_administration.create"),
    canReviewMedicationRequests:
      medicationRequests &&
      hasAllPermissions(permissionIds, [
        "medication_request.read",
        "medication_request.update",
      ]),
  };
}

function normalizePagination(input?: HealthCenterPaginationInput): {
  offset: number;
  limit: number;
} {
  return {
    offset: Math.max(0, Math.trunc(input?.offset ?? 0)),
    limit: Math.min(
      MAX_LIMIT,
      Math.max(1, Math.trunc(input?.limit ?? DEFAULT_LIMIT)),
    ),
  };
}

function hasMorePage(
  pagination: { offset: number; limit: number },
  total: number,
): boolean {
  return pagination.offset + pagination.limit < total;
}

function toInstructionResponseItem(
  item: HealthCenterInstructionItem,
): HealthCenterInstructionResponseItem {
  const instruction = item.instruction;

  return {
    id: instruction.id,
    studentId: instruction.studentId,
    campusId: instruction.campusId,
    student: item.student,
    class: item.class,
    instructionType: instruction.instructionType,
    title: instruction.title,
    instruction: instruction.instruction,
    dosage: instruction.dosage,
    startDate: instruction.startDate,
    endDate: instruction.endDate,
    timesOfDay: instruction.timesOfDay,
    scheduleNotes: instruction.scheduleNotes,
    notes: instruction.notes,
    isActive: instruction.isActive,
    status: StudentHealthInstructionStatus.ACTIVE,
    createdBy: instruction.createdBy,
    lastUpdatedBy: instruction.lastUpdatedBy,
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
  };
}

function toEventResponseItem(
  item: HealthCenterEventItem,
): HealthCenterEventResponseItem {
  const event = item.event;

  return {
    id: event.id,
    studentId: event.studentId,
    campusId: event.campusId,
    student: item.student,
    class: item.class,
    eventType: event.eventType,
    category: event.category,
    title: event.title,
    description: event.description,
    occurredAt: event.occurredAt,
    status: StudentHealthEventStatus.OPEN,
    resolutionNotes: event.resolutionNotes,
    recordedBy: event.recordedBy,
    lastUpdatedBy: event.lastUpdatedBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}
