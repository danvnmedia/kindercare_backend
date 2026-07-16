import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

import {
  StudentHealthInstructionStatus,
  StudentHealthInstructionType,
} from "../enums";
import {
  createStudentHealthArchiveTransition,
  normalizeStudentHealthArchiveState,
} from "./student-health-archive";

export interface StudentHealthInstructionUserSnapshot {
  id: string;
  fullName: string | null;
}

export interface StudentHealthInstructionProps {
  campusId: string;
  studentId: string;
  instructionType: StudentHealthInstructionType;
  title: string;
  instruction: string;
  dosage: string | null;
  startDate: Date;
  endDate: Date | null;
  timesOfDay: string[];
  scheduleNotes: string | null;
  notes: string | null;
  isActive: boolean;
  createdByUserId: string | null;
  createdBy: StudentHealthInstructionUserSnapshot | null;
  lastUpdatedByUserId: string | null;
  lastUpdatedBy: StudentHealthInstructionUserSnapshot | null;
  archivedAt: Date | null;
  archivedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStudentHealthInstructionData {
  campusId: string;
  studentId: string;
  instructionType?: unknown;
  title?: unknown;
  instruction?: unknown;
  dosage?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  timesOfDay?: unknown;
  scheduleNotes?: unknown;
  notes?: unknown;
  isActive?: unknown;
  createdByUserId?: string | null;
  createdBy?: StudentHealthInstructionUserSnapshot | null;
  lastUpdatedByUserId?: string | null;
  lastUpdatedBy?: StudentHealthInstructionUserSnapshot | null;
  archivedAt?: Date | null;
  archivedByUserId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UpdateStudentHealthInstructionData {
  instructionType?: unknown;
  title?: unknown;
  instruction?: unknown;
  dosage?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  timesOfDay?: unknown;
  scheduleNotes?: unknown;
  notes?: unknown;
  isActive?: unknown;
}

const INSTRUCTION_CREATE_FIELDS = [
  "instructionType",
  "title",
  "instruction",
  "dosage",
  "startDate",
  "endDate",
  "timesOfDay",
  "scheduleNotes",
  "notes",
  "isActive",
] as const;

const INSTRUCTION_UPDATE_FIELDS = INSTRUCTION_CREATE_FIELDS;

const TIME_OF_DAY_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class StudentHealthInstruction extends Entity<StudentHealthInstructionProps> {
  get campusId(): string {
    return this.props.campusId;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get instructionType(): StudentHealthInstructionType {
    return this.props.instructionType;
  }

  get title(): string {
    return this.props.title;
  }

  get instruction(): string {
    return this.props.instruction;
  }

  get dosage(): string | null {
    return this.props.dosage;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date | null {
    return this.props.endDate;
  }

  get timesOfDay(): string[] {
    return [...this.props.timesOfDay];
  }

  get scheduleNotes(): string | null {
    return this.props.scheduleNotes;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }

  get createdBy(): StudentHealthInstructionUserSnapshot | null {
    return this.props.createdBy ? { ...this.props.createdBy } : null;
  }

  get lastUpdatedByUserId(): string | null {
    return this.props.lastUpdatedByUserId;
  }

  get lastUpdatedBy(): StudentHealthInstructionUserSnapshot | null {
    return this.props.lastUpdatedBy ? { ...this.props.lastUpdatedBy } : null;
  }

  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  get archivedByUserId(): string | null {
    return this.props.archivedByUserId;
  }

  get isArchived(): boolean {
    return this.props.archivedAt !== null;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  getStatus(
    referenceDate: unknown = new Date(),
  ): StudentHealthInstructionStatus {
    return deriveStudentHealthInstructionStatus(
      this.props,
      normalizeReferenceDate(referenceDate),
    );
  }

  update(data: UpdateStudentHealthInstructionData, actorUserId: string): void {
    assertAllowedKeys(data, INSTRUCTION_UPDATE_FIELDS, "Health instruction");

    if (!actorUserId) {
      throw new Error("Actor user ID is required");
    }

    if (data.instructionType !== undefined) {
      this.props.instructionType = normalizeInstructionType(
        data.instructionType,
      );
    }
    if (data.title !== undefined) {
      this.props.title = normalizeRequiredText(data.title, "Title");
    }
    if (data.instruction !== undefined) {
      this.props.instruction = normalizeRequiredText(
        data.instruction,
        "Instruction",
      );
    }
    if (data.dosage !== undefined) {
      this.props.dosage = normalizeOptionalText(data.dosage, "Dosage");
    }
    if (data.startDate !== undefined) {
      this.props.startDate = normalizeDateOnly(data.startDate, "Start date");
    }
    if (data.endDate !== undefined) {
      this.props.endDate = normalizeOptionalDateOnly(data.endDate, "End date");
    }
    if (data.timesOfDay !== undefined) {
      this.props.timesOfDay = normalizeTimesOfDay(data.timesOfDay);
    }
    if (data.scheduleNotes !== undefined) {
      this.props.scheduleNotes = normalizeOptionalText(
        data.scheduleNotes,
        "Schedule notes",
      );
    }
    if (data.notes !== undefined) {
      this.props.notes = normalizeOptionalText(data.notes, "Notes");
    }
    if (data.isActive !== undefined) {
      this.props.isActive = normalizeBoolean(data.isActive, "isActive");
    }

    assertDateRange(this.props.startDate, this.props.endDate);
    this.props.lastUpdatedByUserId = actorUserId;
    this.props.lastUpdatedBy = null;
    this.touch();
  }

  archive(actorUserId: string, archivedAt = new Date()): boolean {
    if (this.isArchived) {
      return false;
    }

    const archiveState = createStudentHealthArchiveTransition(
      actorUserId,
      archivedAt,
    );
    this.props.archivedAt = archiveState.archivedAt;
    this.props.archivedByUserId = archiveState.archivedByUserId;
    this.touch(archiveState.archivedAt);
    return true;
  }

  static create(
    props: CreateStudentHealthInstructionData,
    id?: string,
  ): StudentHealthInstruction {
    const externalProps = Object.fromEntries(
      Object.entries(props).filter(
        ([key]) =>
          key !== "campusId" &&
          key !== "studentId" &&
          key !== "createdByUserId" &&
          key !== "createdBy" &&
          key !== "lastUpdatedByUserId" &&
          key !== "lastUpdatedBy" &&
          key !== "archivedAt" &&
          key !== "archivedByUserId" &&
          key !== "createdAt" &&
          key !== "updatedAt",
      ),
    );
    assertAllowedKeys(
      externalProps,
      INSTRUCTION_CREATE_FIELDS,
      "Health instruction",
    );

    if (!props.campusId) {
      throw new Error("Campus ID is required for student health instruction");
    }
    if (!props.studentId) {
      throw new Error("Student ID is required for student health instruction");
    }

    const startDate = normalizeDateOnly(props.startDate, "Start date");
    const endDate = normalizeOptionalDateOnly(props.endDate, "End date");
    assertDateRange(startDate, endDate);

    const archiveState = normalizeStudentHealthArchiveState(
      props.archivedAt,
      props.archivedByUserId,
    );
    const normalizedProps: StudentHealthInstructionProps = {
      campusId: props.campusId,
      studentId: props.studentId,
      instructionType: normalizeInstructionType(props.instructionType),
      title: normalizeRequiredText(props.title, "Title"),
      instruction: normalizeRequiredText(props.instruction, "Instruction"),
      dosage: normalizeOptionalText(props.dosage, "Dosage"),
      startDate,
      endDate,
      timesOfDay: normalizeTimesOfDay(props.timesOfDay),
      scheduleNotes: normalizeOptionalText(
        props.scheduleNotes,
        "Schedule notes",
      ),
      notes: normalizeOptionalText(props.notes, "Notes"),
      isActive:
        props.isActive === undefined
          ? true
          : normalizeBoolean(props.isActive, "isActive"),
      createdByUserId: props.createdByUserId ?? null,
      createdBy: props.createdBy ?? null,
      lastUpdatedByUserId: props.lastUpdatedByUserId ?? null,
      lastUpdatedBy: props.lastUpdatedBy ?? null,
      ...archiveState,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new StudentHealthInstruction(
      normalizedProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  private touch(at = new Date()): void {
    this.props.updatedAt = at;
  }
}

export function deriveStudentHealthInstructionStatus(
  instruction: Pick<
    StudentHealthInstructionProps,
    "isActive" | "startDate" | "endDate"
  >,
  referenceDate: Date = normalizeReferenceDate(new Date()),
): StudentHealthInstructionStatus {
  if (!instruction.isActive) {
    return StudentHealthInstructionStatus.INACTIVE;
  }

  const reference = normalizeReferenceDate(referenceDate).getTime();
  const start = normalizeDateOnly(
    instruction.startDate,
    "Start date",
  ).getTime();
  const end = instruction.endDate
    ? normalizeDateOnly(instruction.endDate, "End date").getTime()
    : null;

  if (reference < start) {
    return StudentHealthInstructionStatus.UPCOMING;
  }
  if (end !== null && end < reference) {
    return StudentHealthInstructionStatus.EXPIRED;
  }
  return StudentHealthInstructionStatus.ACTIVE;
}

export function normalizeReferenceDate(value: unknown = new Date()): Date {
  return normalizeDateOnly(value, "Reference date");
}

export function formatDateOnly(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  return normalizeDateOnly(value, "Date").toISOString().slice(0, 10);
}

export function normalizeInstructionType(
  value: unknown,
): StudentHealthInstructionType {
  if (typeof value !== "string") {
    throw new Error("Instruction type is required");
  }

  const normalized = value.trim();
  const allowedValues = Object.values(StudentHealthInstructionType);
  if (!allowedValues.includes(normalized as StudentHealthInstructionType)) {
    throw new Error(
      `Instruction type must be one of: ${allowedValues.join(", ")}`,
    );
  }

  return normalized as StudentHealthInstructionType;
}

export function normalizeTimesOfDay(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Times of day must be an array");
  }

  const normalized = value.map((item) => {
    if (typeof item !== "string") {
      throw new Error("Times of day must contain HH:mm strings");
    }
    const time = item.trim();
    if (!TIME_OF_DAY_PATTERN.test(time)) {
      throw new Error("Times of day must use HH:mm from 00:00 to 23:59");
    }
    return time;
  });

  return Array.from(new Set(normalized)).sort();
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

function normalizeDateOnly(value: unknown, fieldName: string): Date {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} must be a valid date`);
    }
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value.trim())) {
    throw new Error(`${fieldName} must use YYYY-MM-DD`);
  }

  const [year, month, day] = value.trim().split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return date;
}

function normalizeOptionalDateOnly(
  value: unknown,
  fieldName: string,
): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return normalizeDateOnly(value, fieldName);
}

function normalizeBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }
  return value;
}

function assertDateRange(startDate: Date, endDate: Date | null): void {
  if (endDate && endDate.getTime() < startDate.getTime()) {
    throw new Error("End date must be on or after start date");
  }
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
      `${fieldName} contains unknown field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
    );
  }
}
