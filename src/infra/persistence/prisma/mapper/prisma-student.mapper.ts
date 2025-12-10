/**
 * Prisma Student Mapper
 * Maps between Prisma Student model and domain Student entity
 * Personal information is now stored directly in Student (denormalized)
 */

import {
  Student as PrismaStudent,
  Class as PrismaClass,
  Guardian as PrismaGuardian,
  GuardianRelationship as PrismaGuardianRelationship,
  GuardianStudent as PrismaGuardianStudent,
} from '@prisma/client';
import { Student } from '../../../../domain/user-management/student.entity';
import { Prisma } from '@prisma/client';

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
  /**
   * Map Prisma model to domain entity
   */
  static toDomain(prismaStudent: PrismaStudentWithRelations): Student {
    const guardians = prismaStudent.guardians
      ? prismaStudent.guardians.map((guardianRelation) => ({
          guardianId: guardianRelation.guardian.id,
          fullName: guardianRelation.guardian.fullName,
          email: guardianRelation.guardian.email,
          phoneNumber: guardianRelation.guardian.phoneNumber,
          relationship: guardianRelation.guardianRelationship.id,
          relationshipName: guardianRelation.guardianRelationship.name,
        }))
      : undefined;

    return {
      id: prismaStudent.id,
      studentCode: prismaStudent.studentCode,
      fullName: prismaStudent.fullName,
      email: prismaStudent.email,
      phoneNumber: prismaStudent.phoneNumber,
      address: prismaStudent.address,
      dateOfBirth: prismaStudent.dateOfBirth,
      nickname: prismaStudent.nickname,
      gender: prismaStudent.gender,
      status: prismaStudent.status,
      guardians,
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
      studentCode: student.studentCode,
      fullName: student.fullName,
      email: student.email,
      phoneNumber: student.phoneNumber,
      address: student.address,
      dateOfBirth: student.dateOfBirth,
      nickname: student.nickname,
      gender: student.gender,
      status: student.status ?? 'WAITING',
      isArchived: student.isArchived ?? false,
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
    if (student.status !== undefined) data.status = student.status;
    if (student.studentCode !== undefined) data.studentCode = student.studentCode;
    if (student.isArchived !== undefined) data.isArchived = student.isArchived;

    return data;
  }
}
