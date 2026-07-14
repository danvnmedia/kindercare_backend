import {
  Prisma,
  StudentAttendanceChangeLog as PrismaStudentAttendanceChangeLog,
} from "@prisma/client";
import {
  AttendanceChangeType,
  StudentAttendanceChangeLog,
} from "@/domain/attendance";

export class PrismaStudentAttendanceChangeLogMapper {
  static toDomain(
    row: PrismaStudentAttendanceChangeLog,
  ): StudentAttendanceChangeLog {
    return StudentAttendanceChangeLog.create(
      {
        attendanceSummaryId: row.attendanceSummaryId,
        changeType: row.changeType as AttendanceChangeType,
        previousValue: row.previousValue as Record<string, unknown> | null,
        newValue: row.newValue as Record<string, unknown> | null,
        actorId: row.actorId,
        note: row.note,
        createdAt: row.createdAt,
      },
      row.id,
    );
  }

  static toPrisma(
    changeLog: StudentAttendanceChangeLog,
  ): Prisma.StudentAttendanceChangeLogUncheckedCreateInput {
    return {
      id: changeLog.id,
      attendanceSummaryId: changeLog.attendanceSummaryId,
      changeType: changeLog.changeType,
      previousValue:
        changeLog.previousValue === null
          ? Prisma.JsonNull
          : (changeLog.previousValue as Prisma.InputJsonValue),
      newValue:
        changeLog.newValue === null
          ? Prisma.JsonNull
          : (changeLog.newValue as Prisma.InputJsonValue),
      actorId: changeLog.actorId,
      note: changeLog.note,
      createdAt: changeLog.createdAt,
    };
  }

  static toDomainArray(
    rows: PrismaStudentAttendanceChangeLog[],
  ): StudentAttendanceChangeLog[] {
    return rows.map((row) =>
      PrismaStudentAttendanceChangeLogMapper.toDomain(row),
    );
  }
}
