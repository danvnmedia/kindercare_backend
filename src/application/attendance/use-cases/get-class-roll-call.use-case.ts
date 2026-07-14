import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AbsenceRequestRepository } from "@/application/absence-request";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { EnrollmentRepository } from "@/application/class-management/ports/enrollment.repository";
import {
  AttendanceRollCallState,
  AttendanceStatus,
  StudentAttendanceChangeLog,
  StudentAttendanceSummary,
} from "@/domain/attendance";
import { AbsenceRequest as AbsenceRequestEntity } from "@/domain/absence-request";
import { Student } from "@/domain/user-management/entities/student.entity";
import { User } from "@/domain/user-management/user.entity";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import {
  formatAttendanceDateOnly,
  parseAttendanceDateOnly,
} from "../attendance-date";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";

export interface GetClassRollCallInput {
  campusId: string;
  classId: string;
  date: string | Date;
}

export interface AttendanceRollCallStudent {
  id: string;
  fullName: string;
  nickname: string | null;
  studentCode: string | null;
}

export interface AttendanceApprovedAbsenceContext {
  id: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  startMinute: number | null;
  endMinute: number | null;
  description: string;
  reviewedAt: Date | null;
  reviewNote: string | null;
}

export interface AttendanceChangeLogView {
  id: string;
  changeType: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  actorId: string;
  actor: AttendanceTimelineActor | null;
  note: string | null;
  createdAt: Date;
}

export interface AttendanceTimelineActor {
  id: string;
  displayName: string;
  email: string | null;
}

export interface AttendanceRollCallRow {
  studentId: string;
  student: AttendanceRollCallStudent;
  classId: string;
  date: string;
  state: AttendanceRollCallState;
  attendanceId: string | null;
  attendanceStatus: AttendanceStatus | null;
  absenceRequestId: string | null;
  approvedAbsence: AttendanceApprovedAbsenceContext | null;
  hasApprovedAbsenceWarning: boolean;
  note: string | null;
  updatedById: string | null;
  updatedAt: Date | null;
  timeline: AttendanceChangeLogView[];
}

export interface ClassRollCallSheet {
  campusId: string;
  classId: string;
  date: string;
  rows: AttendanceRollCallRow[];
}

@Injectable()
export class GetClassRollCallUseCase {
  private readonly logger = new Logger(GetClassRollCallUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("ABSENCE_REQUEST_REPOSITORY")
    private readonly absenceRequestRepository: AbsenceRequestRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async execute(input: GetClassRollCallInput): Promise<ClassRollCallSheet> {
    const date = parseAttendanceDateOnly(input.date, "date");
    const dateText = formatAttendanceDateOnly(date);
    this.logger.log(
      `Loading roll-call sheet for class ${input.classId} on ${dateText}`,
    );

    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity || classEntity.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    const enrollments =
      await this.enrollmentRepository.findActiveByClassIdOnDate(
        input.classId,
        date,
      );
    const rosterStudents = enrollments
      .map((enrollment) => enrollment.student)
      .filter((student): student is Student => Boolean(student));
    const studentIds = rosterStudents.map((student) => student.id);

    const [attendanceRows, approvedAbsences] = await Promise.all([
      this.attendanceRepository.findByClassAndDate(input.classId, date),
      this.absenceRequestRepository.findApprovedOverlapsForStudents(
        input.campusId,
        studentIds,
        date,
      ),
    ]);

    const timelineEntries =
      await this.attendanceRepository.findChangeLogsBySummaryIds(
        attendanceRows.map((summary) => summary.id),
      );
    const actorsById = await this.resolveTimelineActors(timelineEntries);
    const attendanceByStudentId = new Map(
      attendanceRows.map((summary) => [summary.studentId, summary]),
    );
    const approvedAbsenceByStudentId = new Map(
      approvedAbsences.map((absence) => [absence.studentId, absence]),
    );

    return {
      campusId: input.campusId,
      classId: input.classId,
      date: dateText,
      rows: rosterStudents.map((student) =>
        this.buildRow({
          student,
          classId: input.classId,
          dateText,
          attendance: attendanceByStudentId.get(student.id),
          approvedAbsence: approvedAbsenceByStudentId.get(student.id),
          timelineEntries,
          actorsById,
        }),
      ),
    };
  }

  private buildRow(input: {
    student: Student;
    classId: string;
    dateText: string;
    attendance?: StudentAttendanceSummary;
    approvedAbsence?: AbsenceRequestEntity;
    timelineEntries: StudentAttendanceChangeLog[];
    actorsById: Map<string, AttendanceTimelineActor>;
  }): AttendanceRollCallRow {
    const state = input.attendance
      ? mapAttendanceStatusToRollCallState(input.attendance.status)
      : input.approvedAbsence
        ? AttendanceRollCallState.ABSENCE_WITH_REQUEST
        : AttendanceRollCallState.NOT_IDENTIFIED;
    const absenceRequestId =
      input.attendance?.absenceRequestId ?? input.approvedAbsence?.id ?? null;

    return {
      studentId: input.student.id,
      student: {
        id: input.student.id,
        fullName: input.student.fullName,
        nickname: input.student.nickname ?? null,
        studentCode: input.student.studentCode ?? null,
      },
      classId: input.classId,
      date: input.dateText,
      state,
      attendanceId: input.attendance?.id ?? null,
      attendanceStatus: input.attendance?.status ?? null,
      absenceRequestId,
      approvedAbsence: input.approvedAbsence
        ? toApprovedAbsenceContext(input.approvedAbsence)
        : null,
      hasApprovedAbsenceWarning: hasApprovedAbsenceWarning(
        input.attendance,
        input.approvedAbsence,
        state,
      ),
      note: input.attendance?.note ?? null,
      updatedById: input.attendance?.updatedById ?? null,
      updatedAt: input.attendance?.updatedAt ?? null,
      timeline: input.attendance
        ? input.timelineEntries
            .filter(
              (entry) => entry.attendanceSummaryId === input.attendance!.id,
            )
            .map((entry) =>
              toChangeLogView(
                entry,
                input.actorsById.get(entry.actorId) ?? null,
              ),
            )
        : [],
    };
  }

  private async resolveTimelineActors(
    timelineEntries: StudentAttendanceChangeLog[],
  ): Promise<Map<string, AttendanceTimelineActor>> {
    const actorIds = [
      ...new Set(timelineEntries.map((entry) => entry.actorId)),
    ];
    if (actorIds.length === 0) {
      return new Map();
    }

    try {
      const users = await this.userRepository.findByIds(actorIds);
      return new Map(users.map((user) => [user.id, toTimelineActor(user)]));
    } catch (error) {
      this.logger.warn(
        `Unable to resolve ${actorIds.length} attendance timeline actors; returning null actor summaries`,
        error instanceof Error ? error.stack : undefined,
      );
      return new Map();
    }
  }
}

function mapAttendanceStatusToRollCallState(
  status: AttendanceStatus,
): AttendanceRollCallState {
  switch (status) {
    case AttendanceStatus.ABSENT:
      return AttendanceRollCallState.ABSENCE_WITHOUT_REQUEST;
    case AttendanceStatus.EXCUSED:
      return AttendanceRollCallState.ABSENCE_WITH_REQUEST;
    case AttendanceStatus.PRESENT:
    case AttendanceStatus.LATE:
    case AttendanceStatus.LEFT_EARLY:
      return AttendanceRollCallState.IN_CLASS;
  }
}

function hasApprovedAbsenceWarning(
  attendance: StudentAttendanceSummary | undefined,
  approvedAbsence: AbsenceRequestEntity | undefined,
  state: AttendanceRollCallState,
): boolean {
  if (!attendance || !approvedAbsence) {
    return false;
  }

  return (
    state !== AttendanceRollCallState.ABSENCE_WITH_REQUEST ||
    attendance.absenceRequestId !== approvedAbsence.id
  );
}

function toApprovedAbsenceContext(
  absence: AbsenceRequestEntity,
): AttendanceApprovedAbsenceContext {
  return {
    id: absence.id,
    absenceType: absence.absenceType,
    startDate: formatAttendanceDateOnly(absence.startDate),
    endDate: formatAttendanceDateOnly(absence.endDate),
    startMinute: absence.startMinute,
    endMinute: absence.endMinute,
    description: absence.description,
    reviewedAt: absence.reviewedAt,
    reviewNote: absence.reviewNote,
  };
}

function toChangeLogView(
  changeLog: StudentAttendanceChangeLog,
  actor: AttendanceTimelineActor | null,
): AttendanceChangeLogView {
  return {
    id: changeLog.id,
    changeType: changeLog.changeType,
    previousValue: changeLog.previousValue,
    newValue: changeLog.newValue,
    actorId: changeLog.actorId,
    actor,
    note: changeLog.note,
    createdAt: changeLog.createdAt,
  };
}

function toTimelineActor(user: User): AttendanceTimelineActor {
  const profile = user.profile;
  const email = profile?.email ?? user.email ?? null;

  return {
    id: user.id,
    displayName: profile?.fullName ?? user.name ?? email ?? user.id,
    email,
  };
}
