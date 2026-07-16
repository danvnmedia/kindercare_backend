import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

import { StudentHealthCheckupType } from "../enums";
import {
  createStudentHealthArchiveTransition,
  normalizeStudentHealthArchiveState,
} from "./student-health-archive";

export interface StudentHealthCheckupUserSnapshot {
  id: string;
  fullName: string | null;
}

export interface StudentHealthCheckupProps {
  campusId: string;
  studentId: string;
  checkupType: StudentHealthCheckupType;
  checkedAt: Date;
  heightCm: number | null;
  weightKg: number | null;
  notes: string | null;
  recordedByUserId: string | null;
  recordedBy: StudentHealthCheckupUserSnapshot | null;
  lastUpdatedByUserId: string | null;
  lastUpdatedBy: StudentHealthCheckupUserSnapshot | null;
  archivedAt: Date | null;
  archivedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStudentHealthCheckupData {
  campusId: string;
  studentId: string;
  checkupType?: unknown;
  checkedAt?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  notes?: unknown;
  recordedByUserId?: string | null;
  recordedBy?: StudentHealthCheckupUserSnapshot | null;
  lastUpdatedByUserId?: string | null;
  lastUpdatedBy?: StudentHealthCheckupUserSnapshot | null;
  archivedAt?: Date | null;
  archivedByUserId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UpdateStudentHealthCheckupData {
  checkupType?: unknown;
  checkedAt?: unknown;
  heightCm?: unknown;
  weightKg?: unknown;
  notes?: unknown;
}

const CHECKUP_UPDATE_FIELDS = [
  "checkupType",
  "checkedAt",
  "heightCm",
  "weightKg",
  "notes",
] as const;

export class StudentHealthCheckup extends Entity<StudentHealthCheckupProps> {
  get campusId(): string {
    return this.props.campusId;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get checkupType(): StudentHealthCheckupType {
    return this.props.checkupType;
  }

  get checkedAt(): Date {
    return this.props.checkedAt;
  }

  get heightCm(): number | null {
    return this.props.heightCm;
  }

  get weightKg(): number | null {
    return this.props.weightKg;
  }

  get notes(): string | null {
    return this.props.notes;
  }

  get recordedByUserId(): string | null {
    return this.props.recordedByUserId;
  }

  get recordedBy(): StudentHealthCheckupUserSnapshot | null {
    return this.props.recordedBy ? { ...this.props.recordedBy } : null;
  }

  get lastUpdatedByUserId(): string | null {
    return this.props.lastUpdatedByUserId;
  }

  get lastUpdatedBy(): StudentHealthCheckupUserSnapshot | null {
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

  update(data: UpdateStudentHealthCheckupData, actorUserId: string): void {
    assertAllowedKeys(data, CHECKUP_UPDATE_FIELDS, "Health checkup");

    if (!actorUserId) {
      throw new Error("Actor user ID is required");
    }

    if (data.checkupType !== undefined) {
      this.props.checkupType = normalizeCheckupType(data.checkupType);
    }
    if (data.checkedAt !== undefined) {
      this.props.checkedAt = normalizeCheckedAt(data.checkedAt);
    }
    if (data.heightCm !== undefined) {
      this.props.heightCm = normalizeOptionalPositiveNumber(
        data.heightCm,
        "Height",
      );
    }
    if (data.weightKg !== undefined) {
      this.props.weightKg = normalizeOptionalPositiveNumber(
        data.weightKg,
        "Weight",
      );
    }
    if (data.notes !== undefined) {
      this.props.notes = normalizeOptionalText(data.notes);
    }

    assertMeaningfulMeasurement(this.props);
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
    props: CreateStudentHealthCheckupData,
    id?: string,
  ): StudentHealthCheckup {
    if (!props.campusId) {
      throw new Error("Campus ID is required for student health checkup");
    }
    if (!props.studentId) {
      throw new Error("Student ID is required for student health checkup");
    }
    const archiveState = normalizeStudentHealthArchiveState(
      props.archivedAt,
      props.archivedByUserId,
    );
    const normalizedProps: StudentHealthCheckupProps = {
      campusId: props.campusId,
      studentId: props.studentId,
      checkupType: normalizeCheckupType(
        props.checkupType ?? StudentHealthCheckupType.GENERAL,
      ),
      checkedAt: normalizeCheckedAt(props.checkedAt),
      heightCm: normalizeOptionalPositiveNumber(props.heightCm, "Height"),
      weightKg: normalizeOptionalPositiveNumber(props.weightKg, "Weight"),
      notes: normalizeOptionalText(props.notes),
      recordedByUserId: props.recordedByUserId ?? null,
      recordedBy: props.recordedBy ?? null,
      lastUpdatedByUserId: props.lastUpdatedByUserId ?? null,
      lastUpdatedBy: props.lastUpdatedBy ?? null,
      ...archiveState,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    assertMeaningfulMeasurement(normalizedProps);

    return new StudentHealthCheckup(
      normalizedProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  private touch(at = new Date()): void {
    this.props.updatedAt = at;
  }
}

export function normalizeCheckupType(value: unknown): StudentHealthCheckupType {
  if (typeof value !== "string") {
    throw new Error("Checkup type is required");
  }

  const normalized = value.trim();
  const allowedValues = Object.values(StudentHealthCheckupType);
  if (!allowedValues.includes(normalized as StudentHealthCheckupType)) {
    throw new Error(`Checkup type must be one of: ${allowedValues.join(", ")}`);
  }

  return normalized as StudentHealthCheckupType;
}

export function normalizeCheckedAt(value: unknown): Date {
  if (value === undefined || value === null || value === "") {
    throw new Error("Checked-at timestamp is required");
  }

  const checkedAt = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(checkedAt.getTime())) {
    throw new Error("Checked-at timestamp must be a valid date");
  }
  if (checkedAt.getTime() > Date.now()) {
    throw new Error("Checked-at timestamp cannot be in the future");
  }

  return checkedAt;
}

export function normalizeOptionalPositiveNumber(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = typeof value === "number" ? value : Number(String(value));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }

  return normalized;
}

export function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Optional text fields must be strings or null");
  }

  const normalized = value.trim();
  return normalized || null;
}

function assertMeaningfulMeasurement(
  props: Pick<StudentHealthCheckupProps, "heightCm" | "weightKg" | "notes">,
): void {
  if (props.heightCm === null && props.weightKg === null && !props.notes) {
    throw new Error(
      "At least one health checkup value must be provided: heightCm, weightKg, or notes",
    );
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
