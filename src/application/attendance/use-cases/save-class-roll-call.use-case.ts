import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AbsenceRequestRepository } from "@/application/absence-request";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { ClassStaffRepository } from "@/application/class-management/ports/class-staff.repository";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import {
  AttendanceChangeType,
  AttendanceRollCallState,
  AttendanceStatus,
  StudentAttendanceChangeLog,
  StudentAttendanceSummary,
} from "@/domain/attendance";
import { AbsenceRequest, AbsenceRequestStatus } from "@/domain/absence-request";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { User } from "@/domain/user-management/user.entity";
import {
  formatAttendanceDateOnly,
  parseAttendanceDateOnly,
} from "../attendance-date";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";

export enum RollCallSaveResultStatus {
  SAVED = "SAVED",
  UNCHANGED = "UNCHANGED",
  SKIPPED = "SKIPPED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  PERMISSION_DENIED = "PERMISSION_DENIED",
}

export enum RollCallSaveReasonCode {
  NOT_IDENTIFIED_NOOP = "NOT_IDENTIFIED_NOOP",
  STUDENT_NOT_IN_CLASS_ROSTER = "STUDENT_NOT_IN_CLASS_ROSTER",
  DUPLICATE_STUDENT_ROW = "DUPLICATE_STUDENT_ROW",
  APPROVED_ABSENCE_REQUIRED = "APPROVED_ABSENCE_REQUIRED",
  ABSENCE_REQUEST_MISMATCH = "ABSENCE_REQUEST_MISMATCH",
  APPROVED_ABSENCE_OVERRIDE_NOTE_REQUIRED = "APPROVED_ABSENCE_OVERRIDE_NOTE_REQUIRED",
  CLASS_STAFF_ROLE_REQUIRED = "CLASS_STAFF_ROLE_REQUIRED",
}

export interface SaveClassRollCallRowInput {
  studentId: string;
  state: AttendanceRollCallState;
  absenceRequestId?: string | null;
  note?: string | null;
}

export interface SaveClassRollCallInput {
  campusId: string;
  classId: string;
  date: string | Date;
  rows: SaveClassRollCallRowInput[];
  currentUser: User;
}

export interface SaveClassRollCallRowResult {
  studentId: string;
  result: RollCallSaveResultStatus;
  reasonCode: RollCallSaveReasonCode | null;
  state: AttendanceRollCallState;
  attendanceId: string | null;
  attendanceStatus: AttendanceStatus | null;
  absenceRequestId: string | null;
}

export interface SaveClassRollCallResult {
  campusId: string;
  classId: string;
  date: string;
  rows: SaveClassRollCallRowResult[];
}

interface DesiredAttendance {
  status: AttendanceStatus;
  absenceRequestId: string | null;
  note: string | null;
}

@Injectable()
export class SaveClassRollCallUseCase {
  private readonly logger = new Logger(SaveClassRollCallUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("ABSENCE_REQUEST_REPOSITORY")
    private readonly absenceRequestRepository: AbsenceRequestRepository,
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("CLASS_STAFF_REPOSITORY")
    private readonly classStaffRepository: ClassStaffRepository,
  ) {}

  async execute(
    input: SaveClassRollCallInput,
  ): Promise<SaveClassRollCallResult> {
    const date = parseAttendanceDateOnly(input.date, "date");
    const dateText = formatAttendanceDateOnly(date);
    this.logger.log(
      `Saving roll-call sheet for class ${input.classId} on ${dateText}`,
    );

    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity || classEntity.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    const permissionFailure = await this.getClassStaffPermissionFailure(input);
    if (permissionFailure) {
      return {
        campusId: input.campusId,
        classId: input.classId,
        date: dateText,
        rows: input.rows.map((row) => ({
          studentId: row.studentId,
          result: RollCallSaveResultStatus.PERMISSION_DENIED,
          reasonCode: permissionFailure,
          state: row.state,
          attendanceId: null,
          attendanceStatus: null,
          absenceRequestId: row.absenceRequestId ?? null,
        })),
      };
    }

    const enrollments =
      await this.enrollmentRepository.findActiveByClassIdOnDate(
        input.classId,
        date,
      );
    const rosterStudentIds = new Set(
      enrollments
        .map((enrollment) => enrollment.studentId)
        .filter((studentId): studentId is string => Boolean(studentId)),
    );
    const [attendanceRows, approvedAbsences] = await Promise.all([
      this.attendanceRepository.findByClassAndDate(input.classId, date),
      this.absenceRequestRepository.findApprovedOverlapsForStudents(
        input.campusId,
        [...rosterStudentIds],
        date,
      ),
    ]);
    const attendanceByStudentId = new Map(
      attendanceRows.map((summary) => [summary.studentId, summary]),
    );
    const approvedAbsenceByStudentId = new Map(
      approvedAbsences.map((absence) => [absence.studentId, absence]),
    );

    const seenStudentIds = new Set<string>();
    const results: SaveClassRollCallRowResult[] = [];
    const changeLogs: StudentAttendanceChangeLog[] = [];

    for (const row of input.rows) {
      if (seenStudentIds.has(row.studentId)) {
        results.push(
          this.validationResult(
            row,
            RollCallSaveReasonCode.DUPLICATE_STUDENT_ROW,
          ),
        );
        continue;
      }
      seenStudentIds.add(row.studentId);

      if (!rosterStudentIds.has(row.studentId)) {
        results.push(
          this.validationResult(
            row,
            RollCallSaveReasonCode.STUDENT_NOT_IN_CLASS_ROSTER,
          ),
        );
        continue;
      }

      if (row.state === AttendanceRollCallState.NOT_IDENTIFIED) {
        results.push({
          studentId: row.studentId,
          result: RollCallSaveResultStatus.SKIPPED,
          reasonCode: RollCallSaveReasonCode.NOT_IDENTIFIED_NOOP,
          state: row.state,
          attendanceId: attendanceByStudentId.get(row.studentId)?.id ?? null,
          attendanceStatus:
            attendanceByStudentId.get(row.studentId)?.status ?? null,
          absenceRequestId:
            attendanceByStudentId.get(row.studentId)?.absenceRequestId ?? null,
        });
        continue;
      }

      const existing = attendanceByStudentId.get(row.studentId);
      const approvedAbsence = approvedAbsenceByStudentId.get(row.studentId);
      const desired = this.resolveDesiredAttendance(
        row,
        existing,
        approvedAbsence,
      );
      if (!desired.ok) {
        results.push(this.validationResult(row, desired.reasonCode));
        continue;
      }

      const saved = existing
        ? await this.updateExistingAttendance({
            existing,
            desired: desired.value,
            actorId: input.currentUser.id.toString(),
            approvedAbsence,
            rowState: row.state,
            changeLogs,
          })
        : await this.createAttendance({
            campusId: input.campusId,
            classId: input.classId,
            date,
            row,
            desired: desired.value,
            actorId: input.currentUser.id.toString(),
            approvedAbsence,
            changeLogs,
          });

      attendanceByStudentId.set(row.studentId, saved.summary);
      results.push({
        studentId: row.studentId,
        result: saved.changed
          ? RollCallSaveResultStatus.SAVED
          : RollCallSaveResultStatus.UNCHANGED,
        reasonCode: null,
        state: row.state,
        attendanceId: saved.summary.id,
        attendanceStatus: saved.summary.status,
        absenceRequestId: saved.summary.absenceRequestId,
      });
    }

    if (changeLogs.length > 0) {
      await this.attendanceRepository.saveChangeLogs(changeLogs);
    }

    return {
      campusId: input.campusId,
      classId: input.classId,
      date: dateText,
      rows: results,
    };
  }

  private async getClassStaffPermissionFailure(
    input: SaveClassRollCallInput,
  ): Promise<RollCallSaveReasonCode | null> {
    const isGlobalAdmin = input.currentUser
      .getGlobalRoles()
      .some((role) => role.isSystemRole === true);
    if (isGlobalAdmin) {
      return null;
    }

    const userId = input.currentUser.id.toString();
    const staff = await this.staffRepository.findByUserIdInCampus(
      input.campusId,
      userId,
    );

    if (!staff || staff.campusId !== input.campusId || staff.isArchived) {
      return RollCallSaveReasonCode.CLASS_STAFF_ROLE_REQUIRED;
    }

    const classStaff = await this.classStaffRepository.findByPair(
      input.classId,
      staff.id,
    );
    if (
      !classStaff ||
      ![ClassStaffRole.HOMEROOM, ClassStaffRole.ASSISTANT].includes(
        classStaff.role,
      )
    ) {
      return RollCallSaveReasonCode.CLASS_STAFF_ROLE_REQUIRED;
    }

    return null;
  }

  private resolveDesiredAttendance(
    row: SaveClassRollCallRowInput,
    existing: StudentAttendanceSummary | undefined,
    approvedAbsence: AbsenceRequest | undefined,
  ):
    | { ok: true; value: DesiredAttendance }
    | { ok: false; reasonCode: RollCallSaveReasonCode } {
    const note = normalizeNote(row.note, existing?.note ?? null);

    if (row.state === AttendanceRollCallState.ABSENCE_WITH_REQUEST) {
      if (
        !approvedAbsence ||
        approvedAbsence.status !== AbsenceRequestStatus.APPROVED
      ) {
        return {
          ok: false,
          reasonCode: RollCallSaveReasonCode.APPROVED_ABSENCE_REQUIRED,
        };
      }
      if (row.absenceRequestId && row.absenceRequestId !== approvedAbsence.id) {
        return {
          ok: false,
          reasonCode: RollCallSaveReasonCode.ABSENCE_REQUEST_MISMATCH,
        };
      }

      return {
        ok: true,
        value: {
          status: AttendanceStatus.EXCUSED,
          absenceRequestId: approvedAbsence.id,
          note,
        },
      };
    }

    if (approvedAbsence && !hasNonBlankNote(row.note)) {
      return {
        ok: false,
        reasonCode:
          RollCallSaveReasonCode.APPROVED_ABSENCE_OVERRIDE_NOTE_REQUIRED,
      };
    }

    return {
      ok: true,
      value: {
        status:
          row.state === AttendanceRollCallState.IN_CLASS
            ? AttendanceStatus.PRESENT
            : AttendanceStatus.ABSENT,
        absenceRequestId: null,
        note,
      },
    };
  }

  private async createAttendance(input: {
    campusId: string;
    classId: string;
    date: Date;
    row: SaveClassRollCallRowInput;
    desired: DesiredAttendance;
    actorId: string;
    approvedAbsence?: AbsenceRequest;
    changeLogs: StudentAttendanceChangeLog[];
  }): Promise<{ summary: StudentAttendanceSummary; changed: boolean }> {
    const summary = StudentAttendanceSummary.create({
      campusId: input.campusId,
      studentId: input.row.studentId,
      classId: input.classId,
      date: input.date,
      status: input.desired.status,
      absenceRequestId: input.desired.absenceRequestId,
      updatedById: input.actorId,
      note: input.desired.note,
    });
    const saved = await this.attendanceRepository.save(summary);
    this.addOverrideLogForCreate(input, saved);
    return { summary: saved, changed: true };
  }

  private async updateExistingAttendance(input: {
    existing: StudentAttendanceSummary;
    desired: DesiredAttendance;
    actorId: string;
    approvedAbsence?: AbsenceRequest;
    rowState: AttendanceRollCallState;
    changeLogs: StudentAttendanceChangeLog[];
  }): Promise<{ summary: StudentAttendanceSummary; changed: boolean }> {
    const previousStatus = input.existing.status;
    const previousNote = input.existing.note;
    const previousAbsenceRequestId = input.existing.absenceRequestId;
    const changed =
      previousStatus !== input.desired.status ||
      previousNote !== input.desired.note ||
      previousAbsenceRequestId !== input.desired.absenceRequestId;

    if (!changed) {
      return { summary: input.existing, changed: false };
    }

    input.existing.update({
      status: input.desired.status,
      absenceRequestId: input.desired.absenceRequestId,
      note: input.desired.note,
      updatedById: input.actorId,
    });
    const updated = await this.attendanceRepository.update(input.existing);
    this.addChangeLogsForUpdate({
      attendanceSummaryId: updated.id,
      previousStatus,
      previousNote,
      previousAbsenceRequestId,
      desired: input.desired,
      actorId: input.actorId,
      approvedAbsence: input.approvedAbsence,
      rowState: input.rowState,
      note: input.desired.note,
      changeLogs: input.changeLogs,
    });
    return { summary: updated, changed: true };
  }

  private addOverrideLogForCreate(
    input: {
      row: SaveClassRollCallRowInput;
      actorId: string;
      approvedAbsence?: AbsenceRequest;
      desired: DesiredAttendance;
      changeLogs: StudentAttendanceChangeLog[];
    },
    saved: StudentAttendanceSummary,
  ): void {
    if (
      input.approvedAbsence &&
      input.row.state !== AttendanceRollCallState.ABSENCE_WITH_REQUEST
    ) {
      input.changeLogs.push(
        StudentAttendanceChangeLog.create({
          attendanceSummaryId: saved.id,
          changeType: AttendanceChangeType.APPROVED_ABSENCE_OVERRIDDEN,
          previousValue: {
            absenceRequestId: input.approvedAbsence.id,
            state: AttendanceRollCallState.ABSENCE_WITH_REQUEST,
          },
          newValue: {
            absenceRequestId: null,
            state: input.row.state,
            status: input.desired.status,
          },
          actorId: input.actorId,
          note: input.desired.note,
        }),
      );
    }
  }

  private addChangeLogsForUpdate(input: {
    attendanceSummaryId: string;
    previousStatus: AttendanceStatus;
    previousNote: string | null;
    previousAbsenceRequestId: string | null;
    desired: DesiredAttendance;
    actorId: string;
    approvedAbsence?: AbsenceRequest;
    rowState: AttendanceRollCallState;
    note: string | null;
    changeLogs: StudentAttendanceChangeLog[];
  }): void {
    if (input.previousStatus !== input.desired.status) {
      input.changeLogs.push(
        this.createChangeLog(
          input.attendanceSummaryId,
          AttendanceChangeType.STATUS_CHANGED,
          { status: input.previousStatus },
          { status: input.desired.status },
          input.actorId,
          input.note,
        ),
      );
    }
    if (input.previousNote !== input.desired.note) {
      input.changeLogs.push(
        this.createChangeLog(
          input.attendanceSummaryId,
          AttendanceChangeType.NOTE_CHANGED,
          { note: input.previousNote },
          { note: input.desired.note },
          input.actorId,
          input.note,
        ),
      );
    }
    if (input.previousAbsenceRequestId !== input.desired.absenceRequestId) {
      input.changeLogs.push(
        this.createChangeLog(
          input.attendanceSummaryId,
          AttendanceChangeType.ABSENCE_REQUEST_CHANGED,
          { absenceRequestId: input.previousAbsenceRequestId },
          { absenceRequestId: input.desired.absenceRequestId },
          input.actorId,
          input.note,
        ),
      );
    }
    if (
      input.approvedAbsence &&
      input.rowState !== AttendanceRollCallState.ABSENCE_WITH_REQUEST
    ) {
      input.changeLogs.push(
        this.createChangeLog(
          input.attendanceSummaryId,
          AttendanceChangeType.APPROVED_ABSENCE_OVERRIDDEN,
          {
            absenceRequestId: input.approvedAbsence.id,
            state: AttendanceRollCallState.ABSENCE_WITH_REQUEST,
          },
          {
            absenceRequestId: null,
            state: input.rowState,
            status: input.desired.status,
          },
          input.actorId,
          input.note,
        ),
      );
    }
  }

  private createChangeLog(
    attendanceSummaryId: string,
    changeType: AttendanceChangeType,
    previousValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    actorId: string,
    note: string | null,
  ): StudentAttendanceChangeLog {
    return StudentAttendanceChangeLog.create({
      attendanceSummaryId,
      changeType,
      previousValue,
      newValue,
      actorId,
      note,
    });
  }

  private validationResult(
    row: SaveClassRollCallRowInput,
    reasonCode: RollCallSaveReasonCode,
  ): SaveClassRollCallRowResult {
    return {
      studentId: row.studentId,
      result: RollCallSaveResultStatus.VALIDATION_ERROR,
      reasonCode,
      state: row.state,
      attendanceId: null,
      attendanceStatus: null,
      absenceRequestId: row.absenceRequestId ?? null,
    };
  }
}

function normalizeNote(
  value: string | null | undefined,
  fallback: string | null,
): string | null {
  if (value === undefined) {
    return fallback;
  }

  return value?.trim() || null;
}

function hasNonBlankNote(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
