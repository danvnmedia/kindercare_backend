import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

import {
  StudentHealthConditionCategory,
  StudentHealthEventStatus,
  StudentHealthEventType,
} from "../enums";

export interface StudentHealthEventUserSnapshot {
  id: string;
  fullName: string | null;
}

export interface StudentHealthEventProps {
  campusId: string;
  studentId: string;
  eventType: StudentHealthEventType;
  category: StudentHealthConditionCategory | null;
  title: string;
  description: string | null;
  occurredAt: Date;
  status: StudentHealthEventStatus;
  resolutionNotes: string | null;
  recordedByUserId: string | null;
  recordedBy: StudentHealthEventUserSnapshot | null;
  lastUpdatedByUserId: string | null;
  lastUpdatedBy: StudentHealthEventUserSnapshot | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStudentHealthEventData {
  campusId: string;
  studentId: string;
  eventType?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  occurredAt?: unknown;
  status?: unknown;
  resolutionNotes?: unknown;
  recordedByUserId?: string | null;
  recordedBy?: StudentHealthEventUserSnapshot | null;
  lastUpdatedByUserId?: string | null;
  lastUpdatedBy?: StudentHealthEventUserSnapshot | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UpdateStudentHealthEventData {
  eventType?: unknown;
  category?: unknown;
  title?: unknown;
  description?: unknown;
  occurredAt?: unknown;
  status?: unknown;
  resolutionNotes?: unknown;
}

const EVENT_MUTATION_FIELDS = [
  "eventType",
  "category",
  "title",
  "description",
  "occurredAt",
  "status",
  "resolutionNotes",
] as const;

export class StudentHealthEvent extends Entity<StudentHealthEventProps> {
  get campusId(): string {
    return this.props.campusId;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get eventType(): StudentHealthEventType {
    return this.props.eventType;
  }

  get category(): StudentHealthConditionCategory | null {
    return this.props.category;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string | null {
    return this.props.description;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  get status(): StudentHealthEventStatus {
    return this.props.status;
  }

  get resolutionNotes(): string | null {
    return this.props.resolutionNotes;
  }

  get recordedByUserId(): string | null {
    return this.props.recordedByUserId;
  }

  get recordedBy(): StudentHealthEventUserSnapshot | null {
    return this.props.recordedBy ? { ...this.props.recordedBy } : null;
  }

  get lastUpdatedByUserId(): string | null {
    return this.props.lastUpdatedByUserId;
  }

  get lastUpdatedBy(): StudentHealthEventUserSnapshot | null {
    return this.props.lastUpdatedBy ? { ...this.props.lastUpdatedBy } : null;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(data: UpdateStudentHealthEventData, actorUserId: string): void {
    assertAllowedKeys(data, EVENT_MUTATION_FIELDS, "Health event");

    if (!actorUserId) {
      throw new Error("Actor user ID is required");
    }

    if (data.eventType !== undefined) {
      this.props.eventType = normalizeEventType(data.eventType);
    }
    if (data.category !== undefined) {
      this.props.category = normalizeOptionalCategory(data.category);
    }
    if (data.title !== undefined) {
      this.props.title = normalizeRequiredText(data.title, "Title");
    }
    if (data.description !== undefined) {
      this.props.description = normalizeOptionalText(
        data.description,
        "Description",
      );
    }
    if (data.occurredAt !== undefined) {
      this.props.occurredAt = normalizeOccurredAt(data.occurredAt);
    }
    if (data.status !== undefined) {
      this.props.status = normalizeEventStatus(data.status);
    }
    if (data.resolutionNotes !== undefined) {
      this.props.resolutionNotes = normalizeOptionalText(
        data.resolutionNotes,
        "Resolution notes",
      );
    }

    this.props.lastUpdatedByUserId = actorUserId;
    this.props.lastUpdatedBy = null;
    this.touch();
  }

  static create(
    props: CreateStudentHealthEventData,
    id?: string,
  ): StudentHealthEvent {
    const externalProps = Object.fromEntries(
      Object.entries(props).filter(
        ([key]) =>
          key !== "campusId" &&
          key !== "studentId" &&
          key !== "recordedByUserId" &&
          key !== "recordedBy" &&
          key !== "lastUpdatedByUserId" &&
          key !== "lastUpdatedBy" &&
          key !== "createdAt" &&
          key !== "updatedAt",
      ),
    );
    assertAllowedKeys(externalProps, EVENT_MUTATION_FIELDS, "Health event");

    if (!props.campusId) {
      throw new Error("Campus ID is required for student health event");
    }
    if (!props.studentId) {
      throw new Error("Student ID is required for student health event");
    }

    const normalizedProps: StudentHealthEventProps = {
      campusId: props.campusId,
      studentId: props.studentId,
      eventType: normalizeEventType(props.eventType),
      category: normalizeOptionalCategory(props.category),
      title: normalizeRequiredText(props.title, "Title"),
      description: normalizeOptionalText(props.description, "Description"),
      occurredAt: normalizeOccurredAt(props.occurredAt),
      status: normalizeEventStatus(props.status),
      resolutionNotes: normalizeOptionalText(
        props.resolutionNotes,
        "Resolution notes",
      ),
      recordedByUserId: props.recordedByUserId ?? null,
      recordedBy: props.recordedBy ?? null,
      lastUpdatedByUserId: props.lastUpdatedByUserId ?? null,
      lastUpdatedBy: props.lastUpdatedBy ?? null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new StudentHealthEvent(
      normalizedProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}

function normalizeEventType(value: unknown): StudentHealthEventType {
  if (typeof value !== "string") {
    throw new Error("Event type is required");
  }

  const normalized = value.trim();
  const allowedValues = Object.values(StudentHealthEventType);
  if (!allowedValues.includes(normalized as StudentHealthEventType)) {
    throw new Error(`Event type must be one of: ${allowedValues.join(", ")}`);
  }

  return normalized as StudentHealthEventType;
}

function normalizeEventStatus(value: unknown): StudentHealthEventStatus {
  if (typeof value !== "string") {
    throw new Error("Event status is required");
  }

  const normalized = value.trim();
  const allowedValues = Object.values(StudentHealthEventStatus);
  if (!allowedValues.includes(normalized as StudentHealthEventStatus)) {
    throw new Error(`Event status must be one of: ${allowedValues.join(", ")}`);
  }

  return normalized as StudentHealthEventStatus;
}

function normalizeOptionalCategory(
  value: unknown,
): StudentHealthConditionCategory | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Category must be a valid condition category or null");
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const allowedValues = Object.values(StudentHealthConditionCategory);
  if (!allowedValues.includes(normalized as StudentHealthConditionCategory)) {
    throw new Error(`Category must be one of: ${allowedValues.join(", ")}`);
  }

  return normalized as StudentHealthConditionCategory;
}

function normalizeOccurredAt(value: unknown): Date {
  if (value === undefined || value === null || value === "") {
    throw new Error("Occurred-at timestamp is required");
  }

  const occurredAt = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("Occurred-at timestamp must be a valid date");
  }
  if (occurredAt.getTime() > Date.now()) {
    throw new Error("Occurred-at timestamp cannot be in the future");
  }

  return occurredAt;
}

function normalizeRequiredText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}

function normalizeOptionalText(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string or null`);
  }

  const normalized = value.trim();
  return normalized || null;
}

function assertAllowedKeys(
  value: object,
  allowedKeys: readonly string[],
  fieldName: string,
): void {
  const unknownKeys = Object.keys(value).filter(
    (key) => !allowedKeys.includes(key),
  );

  if (unknownKeys.length > 0) {
    throw new Error(
      `Unknown ${fieldName.toLowerCase()} field${
        unknownKeys.length === 1 ? "" : "s"
      }: ${unknownKeys.join(", ")}`,
    );
  }
}
