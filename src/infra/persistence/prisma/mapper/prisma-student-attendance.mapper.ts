import {
  StudentAttendance as PrismaStudentAttendance,
  Class as PrismaClass,
  Student as PrismaStudent,
} from "@prisma/client";
import { StudentAttendance } from "@/domain/attendance/entities/student-attendance.entity";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";
import { Prisma } from "@prisma/client";
import { PrismaClassMapper } from "./prisma-class.mapper";
import { PrismaStudentMapper } from "./prisma-student.mapper";

type PrismaStudentAttendanceWithRelations = PrismaStudentAttendance & {
  class?: PrismaClass | null;
  student?: PrismaStudent | null;
};

export class PrismaStudentAttendanceMapper {
  static toDomain(
    prismaAttendance: PrismaStudentAttendanceWithRelations,
  ): StudentAttendance {
    const props: any = {
      studentId: prismaAttendance.studentId,
      classId: prismaAttendance.classId,
      campusId: prismaAttendance.campusId,
      date: prismaAttendance.date,
      checkinAt: prismaAttendance.checkinAt,
      checkoutAt: prismaAttendance.checkoutAt,
      status: prismaAttendance.status as AttendanceStatus,
      reason: prismaAttendance.reason,
      note: prismaAttendance.note,
      createdAt: prismaAttendance.createdAt,
      updatedAt: prismaAttendance.updatedAt,
    };

    // Map relations if they exist
    if (prismaAttendance.class) {
      props.class = PrismaClassMapper.toDomainSimple(prismaAttendance.class);
    }
    if (prismaAttendance.student) {
      props.student = PrismaStudentMapper.toDomain(prismaAttendance.student);
    }

    return StudentAttendance.create(props, prismaAttendance.id);
  }

  static toDomainSimple(
    prismaAttendance: PrismaStudentAttendance,
  ): StudentAttendance {
    return StudentAttendance.create(
      {
        studentId: prismaAttendance.studentId,
        classId: prismaAttendance.classId,
        campusId: prismaAttendance.campusId,
        date: prismaAttendance.date,
        checkinAt: prismaAttendance.checkinAt,
        checkoutAt: prismaAttendance.checkoutAt,
        status: prismaAttendance.status as AttendanceStatus,
        reason: prismaAttendance.reason,
        note: prismaAttendance.note,
        createdAt: prismaAttendance.createdAt,
        updatedAt: prismaAttendance.updatedAt,
      },
      prismaAttendance.id,
    );
  }

  static toPrisma(
    attendance: StudentAttendance,
  ): Prisma.StudentAttendanceUncheckedCreateInput {
    return {
      id: attendance.id,
      studentId: attendance.studentId,
      classId: attendance.classId,
      campusId: attendance.campusId,
      date: attendance.date,
      checkinAt: attendance.checkinAt,
      checkoutAt: attendance.checkoutAt,
      status: attendance.status,
      reason: attendance.reason,
      note: attendance.note,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
    };
  }

  static toPrismaUpdate(
    attendance: StudentAttendance,
  ): Prisma.StudentAttendanceUpdateInput {
    return {
      checkinAt: attendance.checkinAt,
      checkoutAt: attendance.checkoutAt,
      status: attendance.status,
      reason: attendance.reason,
      note: attendance.note,
      updatedAt: attendance.updatedAt,
    };
  }

  static toDomainArray(
    prismaAttendances: PrismaStudentAttendanceWithRelations[],
  ): StudentAttendance[] {
    return prismaAttendances.map((a) =>
      PrismaStudentAttendanceMapper.toDomain(a),
    );
  }
}
