import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

import {
  MedicationAdministrationOutcome,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestStatus,
  MedicationReviewAction,
} from "../enums";

export const MEDICATION_TEXT_MAX_LENGTH = 4000;
export const MEDICATION_NAME_MAX_LENGTH = 200;
export const MINUTES_PER_DAY = 1440;

const TIME_OF_DAY_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface MedicationStudentSummary {
  id: string;
  fullName: string;
  studentCode?: string | null;
}

export interface MedicationGuardianSummary {
  id: string;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
}

export interface MedicationUserSummary {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface MedicationRequestItem {
  id: string;
  medicationName: string;
  dosage: string | null;
  instructions: string;
  timesOfDay: string[];
  scheduleNotes: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicationRequestTimelineEntryProps {
  requestId: string;
  campusId: string;
  actorType: MedicationRequestTimelineActorType;
  actorUserId?: string | null;
  actorGuardianId?: string | null;
  action: MedicationRequestTimelineAction;
  note?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MedicationRequestTimelineEntry extends Entity<MedicationRequestTimelineEntryProps> {
  static create(
    props: MedicationRequestTimelineEntryProps,
    id?: string,
  ): MedicationRequestTimelineEntry {
    return new MedicationRequestTimelineEntry(
      normalizeTimelineEntryProps(props),
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  get requestId(): string {
    return this.props.requestId;
  }

  get campusId(): string {
    return this.props.campusId;
  }

  get actorType(): MedicationRequestTimelineActorType {
    return this.props.actorType;
  }

  get actorUserId(): string | null {
    return this.props.actorUserId ?? null;
  }

  get actorGuardianId(): string | null {
    return this.props.actorGuardianId ?? null;
  }

  get action(): MedicationRequestTimelineAction {
    return this.props.action;
  }

  get note(): string | null {
    return this.props.note ?? null;
  }

  get createdAt(): Date {
    return this.props.createdAt ?? new Date();
  }

  get updatedAt(): Date {
    return this.props.updatedAt ?? new Date();
  }
}

export interface MedicationRequestProps {
  campusId: string;
  studentId: string;
  requesterGuardianId: string;
  requesterUserId?: string | null;
  status?: MedicationRequestStatus;
  startDate: Date;
  endDate: Date;
  reason?: string | null;
  parentNotes?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  completedAt?: Date | null;
  expiredAt?: Date | null;
  items: MedicationRequestItem[];
  student?: MedicationStudentSummary | null;
  requesterGuardian?: MedicationGuardianSummary | null;
  reviewedByUser?: MedicationUserSummary | null;
  timelineEntries?: MedicationRequestTimelineEntry[];
  occurrences?: MedicationAdministrationOccurrence[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateMedicationRequestItemData {
  id?: string;
  medicationName?: unknown;
  dosage?: unknown;
  instructions?: unknown;
  timesOfDay?: unknown;
  scheduleNotes?: unknown;
  notes?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateMedicationRequestData {
  campusId: string;
  studentId: string;
  requesterGuardianId: string;
  requesterUserId?: string | null;
  status?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  reason?: unknown;
  parentNotes?: unknown;
  reviewedByUserId?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: unknown;
  cancelledAt?: Date | null;
  cancelReason?: unknown;
  completedAt?: Date | null;
  expiredAt?: Date | null;
  items?: unknown;
  student?: MedicationStudentSummary | null;
  requesterGuardian?: MedicationGuardianSummary | null;
  reviewedByUser?: MedicationUserSummary | null;
  timelineEntries?: MedicationRequestTimelineEntry[];
  occurrences?: MedicationAdministrationOccurrence[];
  createdAt?: Date;
  updatedAt?: Date;
}

export class MedicationRequest extends Entity<MedicationRequestProps> {
  static create(
    props: CreateMedicationRequestData,
    id?: string,
  ): MedicationRequest {
    return new MedicationRequest(
      normalizeMedicationRequestProps(props),
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

  get status(): MedicationRequestStatus {
    return this.props.status ?? MedicationRequestStatus.SUBMITTED;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date {
    return this.props.endDate;
  }

  get reason(): string | null {
    return this.props.reason ?? null;
  }

  get parentNotes(): string | null {
    return this.props.parentNotes ?? null;
  }

  get reviewedByUserId(): string | null {
    return this.props.reviewedByUserId ?? null;
  }

  get reviewedAt(): Date | null {
    return this.props.reviewedAt ?? null;
  }

  get reviewNote(): string | null {
    return this.props.reviewNote ?? null;
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt ?? null;
  }

  get cancelReason(): string | null {
    return this.props.cancelReason ?? null;
  }

  get completedAt(): Date | null {
    return this.props.completedAt ?? null;
  }

  get expiredAt(): Date | null {
    return this.props.expiredAt ?? null;
  }

  get items(): MedicationRequestItem[] {
    return this.props.items.map((item) => ({ ...item }));
  }

  get student(): MedicationStudentSummary | null {
    return this.props.student ?? null;
  }

  get requesterGuardian(): MedicationGuardianSummary | null {
    return this.props.requesterGuardian ?? null;
  }

  get reviewedByUser(): MedicationUserSummary | null {
    return this.props.reviewedByUser ?? null;
  }

  get timelineEntries(): MedicationRequestTimelineEntry[] {
    return [...(this.props.timelineEntries ?? [])];
  }

  get occurrences(): MedicationAdministrationOccurrence[] {
    return [...(this.props.occurrences ?? [])];
  }

  get createdAt(): Date {
    return this.props.createdAt ?? new Date();
  }

  get updatedAt(): Date {
    return this.props.updatedAt ?? new Date();
  }

  cancelByParent(reason?: unknown, at = new Date()): void {
    if (
      ![
        MedicationRequestStatus.SUBMITTED,
        MedicationRequestStatus.NEEDS_MORE_INFO,
      ].includes(this.status)
    ) {
      throw new Error(
        "Only submitted or needs-more-info medication requests can be cancelled",
      );
    }

    this.props.status = MedicationRequestStatus.CANCELLED;
    this.props.cancelledAt = at;
    this.props.cancelReason = normalizeOptionalText(reason, "Cancel reason");
    this.touch(at);
  }

  respondToMoreInfo(at = new Date()): void {
    if (this.status !== MedicationRequestStatus.NEEDS_MORE_INFO) {
      throw new Error(
        "Parent response is allowed only when more information is requested",
      );
    }

    this.props.status = MedicationRequestStatus.SUBMITTED;
    this.touch(at);
  }

  reviewByStaff(
    action: MedicationReviewAction,
    reviewerUserId: string,
    note?: unknown,
    at = new Date(),
  ): void {
    if (this.status !== MedicationRequestStatus.SUBMITTED) {
      throw new Error("Only submitted medication requests can be reviewed");
    }

    const nextStatus = getReviewedStatus(action);
    const reviewNote =
      action === MedicationReviewAction.NEEDS_MORE_INFO
        ? normalizeRequiredText(note, "Review note")
        : normalizeOptionalText(note, "Review note");

    this.props.status = nextStatus;
    this.props.reviewedByUserId = normalizeRequiredId(
      reviewerUserId,
      "Reviewer user",
    );
    this.props.reviewedAt = at;
    this.props.reviewNote = reviewNote;
    this.touch(at);
  }

  completeAt(effectiveAt: Date, transitionedAt = new Date()): void {
    if (this.status !== MedicationRequestStatus.APPROVED) {
      throw new Error("Only approved medication requests can be completed");
    }

    this.props.status = MedicationRequestStatus.COMPLETED;
    this.props.completedAt = normalizeTimestamp(effectiveAt, "Completed at");
    this.props.expiredAt = null;
    this.touch(transitionedAt);
  }

  expireAt(effectiveAt: Date, transitionedAt = new Date()): void {
    if (
      ![
        MedicationRequestStatus.SUBMITTED,
        MedicationRequestStatus.NEEDS_MORE_INFO,
      ].includes(this.status)
    ) {
      throw new Error(
        "Only submitted or needs-more-info medication requests can expire",
      );
    }

    this.props.status = MedicationRequestStatus.EXPIRED;
    this.props.expiredAt = normalizeTimestamp(effectiveAt, "Expired at");
    this.props.completedAt = null;
    this.touch(transitionedAt);
  }

  private touch(at = new Date()): void {
    this.props.updatedAt = at;
  }
}

export function materializeAdministrationOccurrences(
  request: MedicationRequest,
): MedicationAdministrationOccurrence[] {
  if (request.status !== MedicationRequestStatus.APPROVED) {
    throw new Error("Only approved medication requests can create occurrences");
  }

  const occurrences: MedicationAdministrationOccurrence[] = [];

  for (const date of iterateDateRange(request.startDate, request.endDate)) {
    for (const item of request.items) {
      for (const timeOfDay of item.timesOfDay) {
        occurrences.push(
          MedicationAdministrationOccurrence.create({
            requestId: request.id,
            medicationItemId: item.id,
            campusId: request.campusId,
            studentId: request.studentId,
            dueDate: date,
            dueMinute: parseTimeToMinute(timeOfDay, "Schedule time"),
          }),
        );
      }
    }
  }

  return occurrences;
}

export interface MedicationAdministrationOccurrenceProps {
  requestId: string;
  medicationItemId: string;
  campusId: string;
  studentId: string;
  dueDate: Date;
  dueMinute: number;
  latestOutcome?: MedicationAdministrationOutcome | null;
  latestLogId?: string | null;
  latestRecordedAt?: Date | null;
  latestRecordedByUserId?: string | null;
  latestNote?: string | null;
  logs?: MedicationAdministrationLog[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateMedicationAdministrationOccurrenceData
  extends Omit<MedicationAdministrationOccurrenceProps, "dueDate"> {
  dueDate?: unknown;
}

export class MedicationAdministrationOccurrence extends Entity<MedicationAdministrationOccurrenceProps> {
  static create(
    props: CreateMedicationAdministrationOccurrenceData,
    id?: string,
  ): MedicationAdministrationOccurrence {
    return new MedicationAdministrationOccurrence(
      normalizeOccurrenceProps(props),
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  get requestId(): string {
    return this.props.requestId;
  }

  get medicationItemId(): string {
    return this.props.medicationItemId;
  }

  get campusId(): string {
    return this.props.campusId;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get dueDate(): Date {
    return this.props.dueDate;
  }

  get dueMinute(): number {
    return this.props.dueMinute;
  }

  get dueTime(): string {
    return formatMinuteAsTime(this.props.dueMinute);
  }

  get latestOutcome(): MedicationAdministrationOutcome | null {
    return this.props.latestOutcome ?? null;
  }

  get latestLogId(): string | null {
    return this.props.latestLogId ?? null;
  }

  get latestRecordedAt(): Date | null {
    return this.props.latestRecordedAt ?? null;
  }

  get latestRecordedByUserId(): string | null {
    return this.props.latestRecordedByUserId ?? null;
  }

  get latestNote(): string | null {
    return this.props.latestNote ?? null;
  }

  get logs(): MedicationAdministrationLog[] {
    return [...(this.props.logs ?? [])];
  }

  get createdAt(): Date {
    return this.props.createdAt ?? new Date();
  }

  get updatedAt(): Date {
    return this.props.updatedAt ?? new Date();
  }

  applyLatestLog(log: MedicationAdministrationLog): void {
    if (log.occurrenceId !== this.id) {
      throw new Error("Administration log does not belong to this occurrence");
    }

    this.props.latestOutcome = log.outcome;
    this.props.latestLogId = log.id;
    this.props.latestRecordedAt = log.recordedAt;
    this.props.latestRecordedByUserId = log.recordedByUserId;
    this.props.latestNote = log.note;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }
}

export interface MedicationAdministrationLogProps {
  occurrenceId: string;
  outcome: MedicationAdministrationOutcome;
  recordedByUserId: string;
  recordedAt?: Date;
  actualMinute?: number | null;
  note?: string | null;
  correctionOfLogId?: string | null;
  recordedByUser?: MedicationUserSummary | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MedicationAdministrationLog extends Entity<MedicationAdministrationLogProps> {
  static create(
    props: MedicationAdministrationLogProps,
    id?: string,
  ): MedicationAdministrationLog {
    return new MedicationAdministrationLog(
      normalizeAdministrationLogProps(props),
      id ? new UniqueEntityID(id) : undefined,
    );
  }

  get occurrenceId(): string {
    return this.props.occurrenceId;
  }

  get outcome(): MedicationAdministrationOutcome {
    return this.props.outcome;
  }

  get recordedByUserId(): string {
    return this.props.recordedByUserId;
  }

  get recordedAt(): Date {
    return this.props.recordedAt ?? new Date();
  }

  get actualMinute(): number | null {
    return this.props.actualMinute ?? null;
  }

  get actualTime(): string | null {
    return this.actualMinute === null
      ? null
      : formatMinuteAsTime(this.actualMinute);
  }

  get note(): string | null {
    return this.props.note ?? null;
  }

  get correctionOfLogId(): string | null {
    return this.props.correctionOfLogId ?? null;
  }

  get recordedByUser(): MedicationUserSummary | null {
    return this.props.recordedByUser ?? null;
  }

  get createdAt(): Date {
    return this.props.createdAt ?? new Date();
  }

  get updatedAt(): Date {
    return this.props.updatedAt ?? new Date();
  }
}

export function normalizeDateOnly(value: unknown, fieldName: string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} must be a valid date`);
    }

    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value.trim())) {
    throw new Error(`${fieldName} must be in YYYY-MM-DD format`);
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

export function formatMedicationDateOnly(
  value: Date | string | null,
): string | null {
  if (value === null) {
    return null;
  }

  return normalizeDateOnly(value, "Date").toISOString().slice(0, 10);
}

export function parseTimeToMinute(value: unknown, fieldName = "Time"): number {
  if (typeof value !== "string" || !TIME_OF_DAY_PATTERN.test(value.trim())) {
    throw new Error(`${fieldName} must be in HH:mm format`);
  }

  const [hours, minutes] = value.trim().split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMinuteAsTime(value: number): string {
  const minute = assertMinute(value, "Time");
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function normalizeTimesOfDay(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("At least one schedule time is required");
  }

  const minutes = Array.from(
    new Set(value.map((item) => parseTimeToMinute(item, "Schedule time"))),
  ).sort((left, right) => left - right);

  if (minutes.length === 0) {
    throw new Error("At least one schedule time is required");
  }

  return minutes.map(formatMinuteAsTime);
}

function normalizeMedicationRequestProps(
  props: CreateMedicationRequestData,
): MedicationRequestProps {
  const startDate = normalizeDateOnly(props.startDate, "Start date");
  const endDate = normalizeDateOnly(props.endDate, "End date");

  if (endDate.getTime() < startDate.getTime()) {
    throw new Error("End date must be on or after start date");
  }

  const items = normalizeMedicationItems(props.items);
  const status = normalizeRequestStatus(
    props.status ?? MedicationRequestStatus.SUBMITTED,
  );

  return {
    campusId: normalizeRequiredId(props.campusId, "Campus"),
    studentId: normalizeRequiredId(props.studentId, "Student"),
    requesterGuardianId: normalizeRequiredId(
      props.requesterGuardianId,
      "Requester guardian",
    ),
    requesterUserId: props.requesterUserId ?? null,
    status,
    startDate,
    endDate,
    reason: normalizeOptionalText(props.reason, "Reason"),
    parentNotes: normalizeOptionalText(props.parentNotes, "Parent notes"),
    reviewedByUserId: props.reviewedByUserId ?? null,
    reviewedAt: props.reviewedAt ?? null,
    reviewNote: normalizeOptionalText(props.reviewNote, "Review note"),
    cancelledAt: props.cancelledAt ?? null,
    cancelReason: normalizeOptionalText(props.cancelReason, "Cancel reason"),
    completedAt: props.completedAt ?? null,
    expiredAt: props.expiredAt ?? null,
    items,
    student: props.student ?? null,
    requesterGuardian: props.requesterGuardian ?? null,
    reviewedByUser: props.reviewedByUser ?? null,
    timelineEntries: props.timelineEntries ?? [],
    occurrences: props.occurrences ?? [],
    createdAt: props.createdAt ?? new Date(),
    updatedAt: props.updatedAt ?? new Date(),
  };
}

function normalizeTimelineEntryProps(
  props: MedicationRequestTimelineEntryProps,
): MedicationRequestTimelineEntryProps {
  const actorType = normalizeTimelineActorType(props.actorType);
  const action = normalizeTimelineAction(props.action);

  if (
    actorType === MedicationRequestTimelineActorType.GUARDIAN &&
    !normalizeOptionalId(props.actorGuardianId, "Actor guardian")
  ) {
    throw new Error(
      "Actor guardian ID is required for guardian timeline entry",
    );
  }

  return {
    requestId: normalizeRequiredId(props.requestId, "Medication request"),
    campusId: normalizeRequiredId(props.campusId, "Campus"),
    actorType,
    actorUserId: normalizeOptionalId(props.actorUserId, "Actor user"),
    actorGuardianId: normalizeOptionalId(
      props.actorGuardianId,
      "Actor guardian",
    ),
    action,
    note: normalizeOptionalText(props.note, "Timeline note"),
    createdAt: props.createdAt ?? new Date(),
    updatedAt: props.updatedAt ?? new Date(),
  };
}

function normalizeMedicationItems(value: unknown): MedicationRequestItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("At least one medication item is required");
  }

  return value.map((rawItem) => {
    const item = rawItem as CreateMedicationRequestItemData;
    const createdAt = item.createdAt ?? new Date();
    const updatedAt = item.updatedAt ?? createdAt;

    return {
      id: item.id ?? new UniqueEntityID().toString(),
      medicationName: normalizeRequiredText(
        item.medicationName,
        "Medication name",
        MEDICATION_NAME_MAX_LENGTH,
      ),
      dosage: normalizeOptionalText(
        item.dosage,
        "Dosage",
        MEDICATION_NAME_MAX_LENGTH,
      ),
      instructions: normalizeRequiredText(item.instructions, "Instructions"),
      timesOfDay: normalizeTimesOfDay(item.timesOfDay),
      scheduleNotes: normalizeOptionalText(
        item.scheduleNotes,
        "Schedule notes",
      ),
      notes: normalizeOptionalText(item.notes, "Notes"),
      createdAt,
      updatedAt,
    };
  });
}

function normalizeOccurrenceProps(
  props: CreateMedicationAdministrationOccurrenceData,
): MedicationAdministrationOccurrenceProps {
  return {
    requestId: normalizeRequiredId(props.requestId, "Medication request"),
    medicationItemId: normalizeRequiredId(
      props.medicationItemId,
      "Medication item",
    ),
    campusId: normalizeRequiredId(props.campusId, "Campus"),
    studentId: normalizeRequiredId(props.studentId, "Student"),
    dueDate: normalizeDateOnly(props.dueDate, "Due date"),
    dueMinute: assertMinute(props.dueMinute, "Due time"),
    latestOutcome:
      props.latestOutcome == null
        ? null
        : normalizeAdministrationOutcome(props.latestOutcome),
    latestLogId: props.latestLogId ?? null,
    latestRecordedAt: props.latestRecordedAt ?? null,
    latestRecordedByUserId: props.latestRecordedByUserId ?? null,
    latestNote: normalizeOptionalText(props.latestNote, "Latest note"),
    logs: props.logs ?? [],
    createdAt: props.createdAt ?? new Date(),
    updatedAt: props.updatedAt ?? new Date(),
  };
}

function normalizeAdministrationLogProps(
  props: MedicationAdministrationLogProps,
): MedicationAdministrationLogProps {
  const outcome = normalizeAdministrationOutcome(props.outcome);
  const note = normalizeOptionalText(props.note, "Note");
  const correctionOfLogId = normalizeOptionalId(
    props.correctionOfLogId,
    "Correction log",
  );

  if (outcome !== MedicationAdministrationOutcome.GIVEN && !note) {
    throw new Error("A note is required for non-given outcomes");
  }

  if (correctionOfLogId && !note) {
    throw new Error("A correction note is required");
  }

  return {
    occurrenceId: normalizeRequiredId(props.occurrenceId, "Occurrence"),
    outcome,
    recordedByUserId: normalizeRequiredId(
      props.recordedByUserId,
      "Recorded by user",
    ),
    recordedAt: props.recordedAt ?? new Date(),
    actualMinute:
      props.actualMinute === null || props.actualMinute === undefined
        ? null
        : assertMinute(props.actualMinute, "Actual time"),
    note,
    correctionOfLogId,
    recordedByUser: props.recordedByUser ?? null,
    createdAt: props.createdAt ?? new Date(),
    updatedAt: props.updatedAt ?? new Date(),
  };
}

function normalizeRequestStatus(value: unknown): MedicationRequestStatus {
  if (
    !Object.values(MedicationRequestStatus).includes(
      value as MedicationRequestStatus,
    )
  ) {
    throw new Error("Invalid medication request status");
  }

  return value as MedicationRequestStatus;
}

function normalizeTimestamp(value: Date, fieldName: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${fieldName} must be a valid timestamp`);
  }

  return value;
}

function normalizeAdministrationOutcome(
  value: unknown,
): MedicationAdministrationOutcome {
  if (
    !Object.values(MedicationAdministrationOutcome).includes(
      value as MedicationAdministrationOutcome,
    )
  ) {
    throw new Error("Invalid medication administration outcome");
  }

  return value as MedicationAdministrationOutcome;
}

function getReviewedStatus(
  action: MedicationReviewAction,
): MedicationRequestStatus {
  switch (action) {
    case MedicationReviewAction.APPROVE:
      return MedicationRequestStatus.APPROVED;
    case MedicationReviewAction.REJECT:
      return MedicationRequestStatus.REJECTED;
    case MedicationReviewAction.NEEDS_MORE_INFO:
      return MedicationRequestStatus.NEEDS_MORE_INFO;
    default:
      throw new Error("Invalid medication review action");
  }
}

function* iterateDateRange(startDate: Date, endDate: Date): Generator<Date> {
  for (
    let cursor = new Date(startDate.getTime());
    cursor.getTime() <= endDate.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    yield new Date(cursor.getTime());
  }
}

function normalizeTimelineAction(
  value: unknown,
): MedicationRequestTimelineAction {
  if (
    !Object.values(MedicationRequestTimelineAction).includes(
      value as MedicationRequestTimelineAction,
    )
  ) {
    throw new Error("Invalid medication request timeline action");
  }

  return value as MedicationRequestTimelineAction;
}

function normalizeTimelineActorType(
  value: unknown,
): MedicationRequestTimelineActorType {
  if (
    !Object.values(MedicationRequestTimelineActorType).includes(
      value as MedicationRequestTimelineActorType,
    )
  ) {
    throw new Error("Invalid medication request timeline actor type");
  }

  return value as MedicationRequestTimelineActorType;
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

function normalizeOptionalId(
  value: string | null | undefined,
  fieldName: string,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!value.trim()) {
    throw new Error(`${fieldName} ID is required`);
  }

  return value.trim();
}

function normalizeRequiredText(
  value: unknown,
  fieldName: string,
  maxLength = MEDICATION_TEXT_MAX_LENGTH,
): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldName} is required`);
  }

  if (value.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters`);
  }

  return value.trim();
}

function normalizeOptionalText(
  value: unknown,
  fieldName: string,
  maxLength = MEDICATION_TEXT_MAX_LENGTH,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be text`);
  }

  if (value.trim() === "") {
    return null;
  }

  if (value.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters`);
  }

  return value.trim();
}
