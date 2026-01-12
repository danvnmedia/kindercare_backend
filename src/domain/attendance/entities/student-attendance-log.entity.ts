import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { AttendanceLogType } from "../enums/attendance-log-type.enum";
import { AttendanceLogMethod } from "../enums/attendance-log-method.enum";

export interface StudentAttendanceLogProps {
  attendanceSummaryId: string;
  type: AttendanceLogType;
  timestamp: Date;
  method: AttendanceLogMethod;
  deviceId: string | null;
  createdById: string | null;
  note: string | null;
  imageFileId: string | null;
  createdAt: Date;
}

export type CreateStudentAttendanceLogData = Omit<
  StudentAttendanceLogProps,
  "createdAt"
>;

export class StudentAttendanceLog extends Entity<StudentAttendanceLogProps> {
  // --- Getters ---
  get attendanceSummaryId(): string {
    return this.props.attendanceSummaryId;
  }

  get type(): AttendanceLogType {
    return this.props.type;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get method(): AttendanceLogMethod {
    return this.props.method;
  }

  get deviceId(): string | null {
    return this.props.deviceId;
  }

  get createdById(): string | null {
    return this.props.createdById;
  }

  get note(): string | null {
    return this.props.note;
  }

  get imageFileId(): string | null {
    return this.props.imageFileId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  // --- Factory Method ---

  public static create(
    props: Optional<StudentAttendanceLogProps, "createdAt" | "deviceId" | "createdById" | "note" | "imageFileId">,
    id?: string,
  ): StudentAttendanceLog {
    // Validation
    if (!props.attendanceSummaryId) {
      throw new Error("Attendance Summary ID is required");
    }
    if (!props.type) {
      throw new Error("Type is required");
    }
    if (!props.timestamp) {
      throw new Error("Timestamp is required");
    }
    if (!props.method) {
      throw new Error("Method is required");
    }

    const logProps: StudentAttendanceLogProps = {
      ...props,
      deviceId: props.deviceId ?? null,
      createdById: props.createdById ?? null,
      note: props.note?.trim() || null,
      imageFileId: props.imageFileId ?? null,
      createdAt: props.createdAt ?? new Date(),
    };

    return new StudentAttendanceLog(
      logProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
