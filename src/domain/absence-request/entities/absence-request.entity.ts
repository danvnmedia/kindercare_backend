import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

import { AbsenceRequestStatus, AbsenceRequestType } from "../enums";

export const ABSENCE_REQUEST_TEXT_MAX_LENGTH = 1000;
export const MINUTES_PER_DAY = 1440;

export interface AbsenceRequestStudentSummary {
  id: string;
  fullName: string;
  studentCode?: string | null;
}

export interface AbsenceRequestGuardianSummary {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
}

export interface AbsenceRequestReviewerSummary {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface AbsencePeriod {
  absenceType: AbsenceRequestType;
  startDate: Date;
  endDate: Date;
  startMinute?: number | null;
  endMinute?: number | null;
}

export interface AbsenceRequestProps extends AbsencePeriod {
  campusId: string;
  studentId: string;
  requesterGuardianId: string;
  requesterUserId?: string | null;
  description: string;
  status?: AbsenceRequestStatus;
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  student?: AbsenceRequestStudentSummary | null;
  requesterGuardian?: AbsenceRequestGuardianSummary | null;
  reviewedBy?: AbsenceRequestReviewerSummary | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AbsenceRequest extends Entity<AbsenceRequestProps> {
  static create(props: AbsenceRequestProps, id?: string): AbsenceRequest {
    return new AbsenceRequest(
      normalizeAbsenceRequestProps(props),
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  get campusId(): string {
    return this.props.campusId;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get requesterGuardianId(): string {
    return this.props.requesterGuardianId;
  }

  get requesterUserId(): string | null {
    return this.props.requesterUserId ?? null;
  }

  get absenceType(): AbsenceRequestType {
    return this.props.absenceType;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date {
    return this.props.endDate;
  }

  get startMinute(): number | null {
    return this.props.startMinute ?? null;
  }

  get endMinute(): number | null {
    return this.props.endMinute ?? null;
  }

  get startTime(): string | null {
    return this.startMinute === null
      ? null
      : formatMinuteAsTime(this.startMinute);
  }

  get endTime(): string | null {
    return this.endMinute === null ? null : formatMinuteAsTime(this.endMinute);
  }

  get description(): string {
    return this.props.description;
  }

  get status(): AbsenceRequestStatus {
    return this.props.status ?? AbsenceRequestStatus.PENDING;
  }

  get reviewedById(): string | null {
    return this.props.reviewedById ?? null;
  }

  get reviewedAt(): Date | null {
    return this.props.reviewedAt ?? null;
  }

  get reviewNote(): string | null {
    return this.props.reviewNote ?? null;
  }

  get student(): AbsenceRequestStudentSummary | null {
    return this.props.student ?? null;
  }

  get requesterGuardian(): AbsenceRequestGuardianSummary | null {
    return this.props.requesterGuardian ?? null;
  }

  get reviewedBy(): AbsenceRequestReviewerSummary | null {
    return this.props.reviewedBy ?? null;
  }

  get createdAt(): Date {
    return this.props.createdAt ?? new Date();
  }

  get updatedAt(): Date {
    return this.props.updatedAt ?? new Date();
  }

  get period(): AbsencePeriod {
    return {
      absenceType: this.absenceType,
      startDate: this.startDate,
      endDate: this.endDate,
      startMinute: this.startMinute,
      endMinute: this.endMinute,
    };
  }

  overlaps(other: AbsencePeriod): boolean {
    return absencePeriodsOverlap(this.period, other);
  }

  review(
    status: AbsenceRequestStatus.APPROVED | AbsenceRequestStatus.DENIED,
    reviewerId: string,
    note?: string | null,
  ): void {
    if (this.status !== AbsenceRequestStatus.PENDING) {
      throw new Error("Only pending absence requests can be reviewed");
    }

    if (
      ![AbsenceRequestStatus.APPROVED, AbsenceRequestStatus.DENIED].includes(
        status,
      )
    ) {
      throw new Error("Review status must be APPROVED or DENIED");
    }

    this.props.status = status;
    this.props.reviewedById = normalizeRequiredId(reviewerId, "Reviewer");
    this.props.reviewedAt = new Date();
    this.props.reviewNote = normalizeOptionalText(note, "Review note");
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}

export function normalizeAbsencePeriod(period: AbsencePeriod): AbsencePeriod {
  const absenceType = normalizeAbsenceType(period.absenceType);
  const startDate = normalizeDateOnly(period.startDate, "Start date");
  const endDate = normalizeDateOnly(period.endDate, "End date");

  if (endDate.getTime() < startDate.getTime()) {
    throw new Error("End date must be on or after start date");
  }

  if (absenceType === AbsenceRequestType.FULL_DAY) {
    return {
      absenceType,
      startDate,
      endDate,
      startMinute: null,
      endMinute: null,
    };
  }

  const startMinute = assertMinute(period.startMinute, "Start time");
  const endMinute = assertMinute(period.endMinute, "End time");

  if (startDate.getTime() !== endDate.getTime()) {
    throw new Error(
      "Partial-day absence requests must start and end on the same date",
    );
  }

  if (endMinute <= startMinute) {
    throw new Error("End time must be after start time");
  }

  return {
    absenceType,
    startDate,
    endDate,
    startMinute,
    endMinute,
  };
}

export function absencePeriodsOverlap(
  left: AbsencePeriod,
  right: AbsencePeriod,
): boolean {
  const normalizedLeft = normalizeAbsencePeriod(left);
  const normalizedRight = normalizeAbsencePeriod(right);

  if (
    normalizedLeft.endDate.getTime() < normalizedRight.startDate.getTime() ||
    normalizedRight.endDate.getTime() < normalizedLeft.startDate.getTime()
  ) {
    return false;
  }

  if (
    normalizedLeft.absenceType === AbsenceRequestType.FULL_DAY ||
    normalizedRight.absenceType === AbsenceRequestType.FULL_DAY
  ) {
    return true;
  }

  return (
    normalizedLeft.startMinute! < normalizedRight.endMinute! &&
    normalizedRight.startMinute! < normalizedLeft.endMinute!
  );
}

export function parseTimeToMinute(
  value: string | null | undefined,
): number | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error("Time must be in HH:mm format");
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinuteAsTime(value: number): string {
  const minute = assertMinute(value, "Time");
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function normalizeDateOnly(
  value: Date | string,
  fieldName: string,
): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function getUtcDateOnly(value = new Date()): Date {
  return normalizeDateOnly(value, "Date");
}

function normalizeAbsenceRequestProps(
  props: AbsenceRequestProps,
): AbsenceRequestProps {
  const normalizedPeriod = normalizeAbsencePeriod(props);
  const status = props.status ?? AbsenceRequestStatus.PENDING;

  if (!Object.values(AbsenceRequestStatus).includes(status)) {
    throw new Error("Invalid absence request status");
  }

  const reviewedById = props.reviewedById ?? null;
  const reviewedAt = props.reviewedAt ?? null;

  if (status === AbsenceRequestStatus.PENDING && (reviewedById || reviewedAt)) {
    throw new Error("Pending absence requests cannot have review details");
  }

  if (
    status !== AbsenceRequestStatus.PENDING &&
    (!reviewedById || !reviewedAt)
  ) {
    throw new Error("Reviewed absence requests require reviewer details");
  }

  return {
    ...props,
    ...normalizedPeriod,
    campusId: normalizeRequiredId(props.campusId, "Campus"),
    studentId: normalizeRequiredId(props.studentId, "Student"),
    requesterGuardianId: normalizeRequiredId(
      props.requesterGuardianId,
      "Requester guardian",
    ),
    requesterUserId: props.requesterUserId ?? null,
    description: normalizeRequiredText(props.description, "Description"),
    status,
    reviewedById,
    reviewedAt,
    reviewNote: normalizeOptionalText(props.reviewNote, "Review note"),
    createdAt: props.createdAt ?? new Date(),
    updatedAt: props.updatedAt ?? new Date(),
  };
}

function normalizeAbsenceType(value: AbsenceRequestType): AbsenceRequestType {
  if (!Object.values(AbsenceRequestType).includes(value)) {
    throw new Error("Invalid absence request type");
  }

  return value;
}

function assertMinute(
  value: number | null | undefined,
  fieldName: string,
): number {
  if (value === null || value === undefined || !Number.isInteger(value)) {
    throw new Error(`${fieldName} is required`);
  }

  if (value < 0 || value >= MINUTES_PER_DAY) {
    throw new Error(`${fieldName} must be within the day`);
  }

  return value;
}

function normalizeRequiredId(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (!value?.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  return value;
}

function normalizeRequiredText(
  value: string | null | undefined,
  fieldName: string,
): string {
  if (!value?.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  if (value.length > ABSENCE_REQUEST_TEXT_MAX_LENGTH) {
    throw new Error(
      `${fieldName} must be at most ${ABSENCE_REQUEST_TEXT_MAX_LENGTH} characters`,
    );
  }

  return value.trim();
}

function normalizeOptionalText(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }

  if (value.length > ABSENCE_REQUEST_TEXT_MAX_LENGTH) {
    throw new Error(
      `${fieldName} must be at most ${ABSENCE_REQUEST_TEXT_MAX_LENGTH} characters`,
    );
  }

  return value.trim();
}
