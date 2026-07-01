import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import {
  HealthCenterEventItem,
  HealthCenterInstructionItem,
  StudentHealthEventRepository,
  StudentHealthInstructionRepository,
} from "@/application/student-health/ports";
import {
  StudentHealthEventStatus,
  StudentHealthInstructionStatus,
} from "@/domain/student-health";

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
}

export interface HealthCenterDailyItemsResponse {
  campusId: string;
  date: string;
  classId: string | null;
  counts: HealthCenterDailyItemsCounts;
  pagination: HealthCenterDailyItemsPagination;
  instructions: HealthCenterInstructionResponseItem[];
  events: HealthCenterEventResponseItem[];
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
  ) {}

  async execute(
    input: GetHealthCenterDailyItemsInput,
  ): Promise<HealthCenterDailyItemsResponse> {
    const referenceDate = parseReferenceDate(input.date);
    const classId = input.classId?.trim() || undefined;

    if (classId) {
      const classEntity = await this.classRepository.findById(classId);
      if (!classEntity || classEntity.campusId !== input.campusId) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }
    }

    const instructionsPagination = normalizePagination(input.instructions);
    const eventsPagination = normalizePagination(input.events);

    const [instructions, events] = await Promise.all([
      this.instructionRepository.findActiveForHealthCenter({
        campusId: input.campusId,
        referenceDate,
        classId,
        offset: instructionsPagination.offset,
        limit: instructionsPagination.limit,
      }),
      this.eventRepository.findOpenForHealthCenter({
        campusId: input.campusId,
        referenceDate,
        classId,
        offset: eventsPagination.offset,
        limit: eventsPagination.limit,
      }),
    ]);

    return {
      campusId: input.campusId,
      date: referenceDate.toISOString().slice(0, 10),
      classId: classId ?? null,
      counts: {
        instructions: instructions.total,
        events: events.total,
        total: instructions.total + events.total,
      },
      pagination: {
        instructions: {
          ...instructionsPagination,
          total: instructions.total,
          hasMore:
            instructionsPagination.offset + instructions.data.length <
            instructions.total,
        },
        events: {
          ...eventsPagination,
          total: events.total,
          hasMore: eventsPagination.offset + events.data.length < events.total,
        },
      },
      instructions: instructions.data.map((item) =>
        toInstructionResponseItem(item),
      ),
      events: events.data.map((item) => toEventResponseItem(item)),
    };
  }
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
