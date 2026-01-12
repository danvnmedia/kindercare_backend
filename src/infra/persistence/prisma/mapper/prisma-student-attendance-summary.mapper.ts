import {
  StudentAttendanceSummary as PrismaStudentAttendanceSummary,
  StudentAttendanceLog as PrismaStudentAttendanceLog,
  Class as PrismaClass,
  Student as PrismaStudent,
} from "@prisma/client";
import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";
import { Prisma } from "@prisma/client";
import { PrismaClassMapper } from "./prisma-class.mapper";
import { PrismaStudentMapper } from "./prisma-student.mapper";
import { PrismaStudentAttendanceLogMapper } from "./prisma-student-attendance-log.mapper";

type PrismaStudentAttendanceSummaryWithRelations = PrismaStudentAttendanceSummary & {
  class?: PrismaClass | null;
  student?: PrismaStudent | null;
  logs?: PrismaStudentAttendanceLog[];
};

export class PrismaStudentAttendanceSummaryMapper {
  static toDomain(
    prismaSummary: PrismaStudentAttendanceSummaryWithRelations,
  ): StudentAttendanceSummary {
    const props: any = {
      studentId: prismaSummary.studentId,
      classId: prismaSummary.classId,
      campusId: prismaSummary.campusId,
      date: prismaSummary.date,
      status: prismaSummary.status as AttendanceStatus,
      firstCheckinAt: prismaSummary.firstCheckinAt,
      lastCheckoutAt: prismaSummary.lastCheckoutAt,
      totalMinutesPresent: prismaSummary.totalMinutesPresent,
      updatedById: prismaSummary.updatedById,
      note: prismaSummary.note,
      createdAt: prismaSummary.createdAt,
      updatedAt: prismaSummary.updatedAt,
    };

    // Map relations if they exist
    if (prismaSummary.class) {
      props.class = PrismaClassMapper.toDomainSimple(prismaSummary.class);
    }
    if (prismaSummary.student) {
      props.student = PrismaStudentMapper.toDomain(prismaSummary.student);
    }
    if (prismaSummary.logs) {
      props.logs = PrismaStudentAttendanceLogMapper.toDomainArray(
        prismaSummary.logs,
      );
    }

    return StudentAttendanceSummary.create(props, prismaSummary.id);
  }

  static toDomainSimple(
    prismaSummary: PrismaStudentAttendanceSummary,
  ): StudentAttendanceSummary {
    return StudentAttendanceSummary.create(
      {
        studentId: prismaSummary.studentId,
        classId: prismaSummary.classId,
        campusId: prismaSummary.campusId,
        date: prismaSummary.date,
        status: prismaSummary.status as AttendanceStatus,
        firstCheckinAt: prismaSummary.firstCheckinAt,
        lastCheckoutAt: prismaSummary.lastCheckoutAt,
        totalMinutesPresent: prismaSummary.totalMinutesPresent,
        updatedById: prismaSummary.updatedById,
        note: prismaSummary.note,
        createdAt: prismaSummary.createdAt,
        updatedAt: prismaSummary.updatedAt,
      },
      prismaSummary.id,
    );
  }

  static toPrisma(
    summary: StudentAttendanceSummary,
  ): Prisma.StudentAttendanceSummaryUncheckedCreateInput {
    return {
      id: summary.id,
      studentId: summary.studentId,
      classId: summary.classId,
      campusId: summary.campusId,
      date: summary.date,
      status: summary.status,
      firstCheckinAt: summary.firstCheckinAt,
      lastCheckoutAt: summary.lastCheckoutAt,
      totalMinutesPresent: summary.totalMinutesPresent,
      updatedById: summary.updatedById,
      note: summary.note,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  }

  static toPrismaUpdate(
    summary: StudentAttendanceSummary,
  ): Prisma.StudentAttendanceSummaryUncheckedUpdateInput {
    return {
      status: summary.status,
      firstCheckinAt: summary.firstCheckinAt,
      lastCheckoutAt: summary.lastCheckoutAt,
      totalMinutesPresent: summary.totalMinutesPresent,
      updatedById: summary.updatedById,
      note: summary.note,
      updatedAt: summary.updatedAt,
    };
  }

  static toDomainArray(
    prismaSummaries: PrismaStudentAttendanceSummaryWithRelations[],
  ): StudentAttendanceSummary[] {
    return prismaSummaries.map((s) =>
      PrismaStudentAttendanceSummaryMapper.toDomain(s),
    );
  }
}
