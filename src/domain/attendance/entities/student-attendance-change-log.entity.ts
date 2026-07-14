import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { AttendanceChangeType } from "../enums/attendance-change-type.enum";

export type AttendanceChangeValue = Record<string, unknown> | null;

export interface StudentAttendanceChangeLogProps {
  attendanceSummaryId: string;
  changeType: AttendanceChangeType;
  previousValue: AttendanceChangeValue;
  newValue: AttendanceChangeValue;
  actorId: string;
  note: string | null;
  createdAt: Date;
}

export type CreateStudentAttendanceChangeLogData = Omit<
  StudentAttendanceChangeLogProps,
  "createdAt"
>;

export class StudentAttendanceChangeLog extends Entity<StudentAttendanceChangeLogProps> {
  get attendanceSummaryId(): string {
    return this.props.attendanceSummaryId;
  }

  get changeType(): AttendanceChangeType {
    return this.props.changeType;
  }

  get previousValue(): AttendanceChangeValue {
    return this.props.previousValue;
  }

  get newValue(): AttendanceChangeValue {
    return this.props.newValue;
  }

  get actorId(): string {
    return this.props.actorId;
  }

  get note(): string | null {
    return this.props.note;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(
    props: CreateStudentAttendanceChangeLogData & { createdAt?: Date },
    id?: string,
  ): StudentAttendanceChangeLog {
    if (!props.attendanceSummaryId) {
      throw new Error("Attendance summary ID is required");
    }
    if (!props.changeType) {
      throw new Error("Attendance change type is required");
    }
    if (!props.actorId) {
      throw new Error("Attendance change actor ID is required");
    }

    return new StudentAttendanceChangeLog(
      {
        attendanceSummaryId: props.attendanceSummaryId,
        changeType: props.changeType,
        previousValue: props.previousValue ?? null,
        newValue: props.newValue ?? null,
        actorId: props.actorId,
        note: props.note?.trim() || null,
        createdAt: props.createdAt ?? new Date(),
      },
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
