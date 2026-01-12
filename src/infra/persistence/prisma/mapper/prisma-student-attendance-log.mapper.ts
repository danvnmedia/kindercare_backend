import { StudentAttendanceLog as PrismaStudentAttendanceLog } from "@prisma/client";
import { StudentAttendanceLog } from "@/domain/attendance/entities/student-attendance-log.entity";
import { AttendanceLogType } from "@/domain/attendance/enums/attendance-log-type.enum";
import { AttendanceLogMethod } from "@/domain/attendance/enums/attendance-log-method.enum";
import { Prisma } from "@prisma/client";

export class PrismaStudentAttendanceLogMapper {
  static toDomain(prismaLog: PrismaStudentAttendanceLog): StudentAttendanceLog {
    return StudentAttendanceLog.create(
      {
        attendanceSummaryId: prismaLog.attendanceSummaryId,
        type: prismaLog.type as AttendanceLogType,
        timestamp: prismaLog.timestamp,
        method: prismaLog.method as AttendanceLogMethod,
        deviceId: prismaLog.deviceId,
        createdById: prismaLog.createdById,
        note: prismaLog.note,
        imageFileId: prismaLog.imageFileId,
        createdAt: prismaLog.createdAt,
      },
      prismaLog.id,
    );
  }

  static toPrisma(
    log: StudentAttendanceLog,
  ): Prisma.StudentAttendanceLogUncheckedCreateInput {
    return {
      id: log.id,
      attendanceSummaryId: log.attendanceSummaryId,
      type: log.type,
      timestamp: log.timestamp,
      method: log.method,
      deviceId: log.deviceId,
      createdById: log.createdById,
      note: log.note,
      imageFileId: log.imageFileId,
      createdAt: log.createdAt,
    };
  }

  static toDomainArray(
    prismaLogs: PrismaStudentAttendanceLog[],
  ): StudentAttendanceLog[] {
    return prismaLogs.map((log) =>
      PrismaStudentAttendanceLogMapper.toDomain(log),
    );
  }
}
