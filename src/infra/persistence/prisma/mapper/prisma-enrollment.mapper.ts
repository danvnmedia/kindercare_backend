import {
  Enrollment as PrismaEnrollment,
  Class as PrismaClass,
  Student as PrismaStudent,
} from "@prisma/client";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { Prisma } from "@prisma/client";
import { PrismaClassMapper } from "./prisma-class.mapper";
import { PrismaStudentMapper } from "./prisma-student.mapper";

type PrismaEnrollmentWithRelations = PrismaEnrollment & {
  class?: PrismaClass | null;
  student?: PrismaStudent | null;
};

export class PrismaEnrollmentMapper {
  static toDomain(prismaEnrollment: PrismaEnrollmentWithRelations): Enrollment {
    const props: any = {
      classId: prismaEnrollment.classId,
      studentId: prismaEnrollment.studentId,
      enrollmentDate: prismaEnrollment.enrollmentDate,
      note: prismaEnrollment.note,
      createdAt: prismaEnrollment.createdAt,
      updatedAt: prismaEnrollment.updatedAt,
    };

    // Map relations if they exist
    if (prismaEnrollment.class) {
      props.class = PrismaClassMapper.toDomainSimple(prismaEnrollment.class);
    }
    if (prismaEnrollment.student) {
      props.student = PrismaStudentMapper.toDomain(prismaEnrollment.student);
    }

    return Enrollment.create(props, prismaEnrollment.id);
  }

  static toDomainSimple(prismaEnrollment: PrismaEnrollment): Enrollment {
    return Enrollment.create(
      {
        classId: prismaEnrollment.classId,
        studentId: prismaEnrollment.studentId,
        enrollmentDate: prismaEnrollment.enrollmentDate,
        note: prismaEnrollment.note,
        createdAt: prismaEnrollment.createdAt,
        updatedAt: prismaEnrollment.updatedAt,
      },
      prismaEnrollment.id,
    );
  }

  static toPrisma(
    enrollment: Enrollment,
  ): Prisma.EnrollmentUncheckedCreateInput {
    return {
      id: enrollment.id,
      classId: enrollment.classId,
      studentId: enrollment.studentId,
      enrollmentDate: enrollment.enrollmentDate,
      note: enrollment.note,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    };
  }

  static toPrismaUpdate(enrollment: Enrollment): Prisma.EnrollmentUpdateInput {
    return {
      enrollmentDate: enrollment.enrollmentDate,
      note: enrollment.note,
      updatedAt: enrollment.updatedAt,
    };
  }

  static toDomainArray(
    prismaEnrollments: PrismaEnrollmentWithRelations[],
  ): Enrollment[] {
    return prismaEnrollments.map((e) => PrismaEnrollmentMapper.toDomain(e));
  }
}
