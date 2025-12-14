import {
  Student as PrismaStudent,
  Class as PrismaClass,
  Guardian as PrismaGuardian,
  GuardianRelationship as PrismaGuardianRelationship,
  GuardianStudent as PrismaGuardianStudent,
} from "@prisma/client";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";
import { Prisma } from "@prisma/client";

type PrismaStudentWithRelations = PrismaStudent & {
  class?: PrismaClass | null;
  guardians?: Array<
    PrismaGuardianStudent & {
      guardian: PrismaGuardian;
      guardianRelationship: PrismaGuardianRelationship;
    }
  >;
};

export class PrismaStudentMapper {
  static toDomain(prismaStudent: PrismaStudentWithRelations): Student {
    const studentProps = {
      studentCode: prismaStudent.studentCode,
      fullName: prismaStudent.fullName,
      email: prismaStudent.email,
      phoneNumber: prismaStudent.phoneNumber,
      address: prismaStudent.address,
      dateOfBirth: prismaStudent.dateOfBirth,
      nickname: prismaStudent.nickname,
      gender: prismaStudent.gender as Gender | null,
      status: prismaStudent.status as StudentStatus,
      isArchived: prismaStudent.isArchived,
      createdAt: prismaStudent.createdAt,
      updatedAt: prismaStudent.updatedAt,
    };

    // Note: The 'guardians' property is denormalized and not part of the core
    // StudentProps. It should be loaded and attached at the repository or use-case level.
    return Student.create(studentProps, prismaStudent.id);
  }

  static toDomainSimple(prismaStudent: PrismaStudent): Student {
    const studentProps = {
      studentCode: prismaStudent.studentCode,
      fullName: prismaStudent.fullName,
      email: prismaStudent.email,
      phoneNumber: prismaStudent.phoneNumber,
      address: prismaStudent.address,
      dateOfBirth: prismaStudent.dateOfBirth,
      nickname: prismaStudent.nickname,
      gender: prismaStudent.gender as Gender | null,
      status: prismaStudent.status as StudentStatus,
      isArchived: prismaStudent.isArchived,
      createdAt: prismaStudent.createdAt,
      updatedAt: prismaStudent.updatedAt,
    };
    return Student.create(studentProps, prismaStudent.id);
  }

  static toPrisma(student: Student): Prisma.StudentUncheckedCreateInput {
    return {
      id: student.id,
      studentCode: student.studentCode,
      fullName: student.fullName,
      email: student.email,
      phoneNumber: student.phoneNumber,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      nickname: student.nickname,
      gender: student.gender,
      status: student.status,
      isArchived: student.isArchived,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }

  static toPrismaUpdate(student: Student): Prisma.StudentUpdateInput {
    return {
      studentCode: student.studentCode,
      fullName: student.fullName,
      email: student.email,
      phoneNumber: student.phoneNumber,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      nickname: student.nickname,
      gender: student.gender,
      status: student.status,
      isArchived: student.isArchived,
      updatedAt: student.updatedAt,
    };
  }

  static toDomainArray(
    prismaStudents: PrismaStudentWithRelations[],
  ): Student[] {
    return prismaStudents.map((prismaStudent) =>
      PrismaStudentMapper.toDomain(prismaStudent),
    );
  }
}
