/**
 * Prisma Student Mapper
 * Maps between Prisma Student model and domain Student entity
 * Personal information is now stored directly in Student (denormalized)
 */

import { Student as PrismaStudent, Class as PrismaClass } from '@prisma/client';
import { Student } from '../../../../domain/user-management/student.entity';
import { Prisma } from '@prisma/client';

type PrismaStudentWithRelations = PrismaStudent & {
  class?: PrismaClass | null;
  parents?: any[];
};

export class PrismaStudentMapper {
  /**
   * Map Prisma model to domain entity
   */
  static toDomain(prismaStudent: PrismaStudentWithRelations): Student {
    return {
      id: prismaStudent.id,
      fullName: prismaStudent.fullName,
      email: prismaStudent.email,
      phoneNumber: prismaStudent.phoneNumber,
      address: prismaStudent.address,
      dateOfBirth: prismaStudent.dateOfBirth,
      nickname: prismaStudent.nickname,
      gender: prismaStudent.gender,
      enrollmentDate: prismaStudent.enrollmentDate,
      isOnTrack: prismaStudent.isOnTrack,
      classId: prismaStudent.classId,
      isArchived: prismaStudent.isArchived,
      createdAt: prismaStudent.createdAt,
      updatedAt: prismaStudent.updatedAt,
    };
  }

  /**
   * Map domain entity to Prisma create input
   */
  static toPrismaCreate(
    student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>,
  ): Prisma.StudentCreateInput {
    return {
      fullName: student.fullName,
      email: student.email,
      phoneNumber: student.phoneNumber,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      nickname: student.nickname,
      gender: student.gender,
      enrollmentDate: student.enrollmentDate,
      isOnTrack: student.isOnTrack ?? true,
      isArchived: student.isArchived ?? false,
      class: student.classId
        ? {
            connect: { id: student.classId },
          }
        : undefined,
    };
  }

  /**
   * Map partial domain entity to Prisma update input
   */
  static toPrismaUpdate(student: Partial<Student>): Prisma.StudentUpdateInput {
    const data: Prisma.StudentUpdateInput = {};

    if (student.fullName !== undefined) data.fullName = student.fullName;
    if (student.email !== undefined) data.email = student.email;
    if (student.phoneNumber !== undefined) data.phoneNumber = student.phoneNumber;
    if (student.address !== undefined) data.address = student.address;
    if (student.dateOfBirth !== undefined) data.dateOfBirth = student.dateOfBirth;
    if (student.nickname !== undefined) data.nickname = student.nickname;
    if (student.gender !== undefined) data.gender = student.gender;
    if (student.enrollmentDate !== undefined)
      data.enrollmentDate = student.enrollmentDate;
    if (student.isOnTrack !== undefined) data.isOnTrack = student.isOnTrack;
    if (student.isArchived !== undefined) data.isArchived = student.isArchived;
    if (student.classId !== undefined) {
      data.class = student.classId
        ? { connect: { id: student.classId } }
        : { disconnect: true };
    }

    return data;
  }
}
