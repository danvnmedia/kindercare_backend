/**
 * Prisma Guardian Mapper
 * Maps between Prisma Guardian model and domain Guardian entity
 * Personal information is stored directly in Guardian (denormalized)
 */

import {
  Guardian as PrismaGuardian,
  Prisma,
  Student as PrismaStudent,
  GuardianStudent as PrismaGuardianStudent,
  GuardianRelationship as PrismaGuardianRelationship,
} from "@prisma/client";
import {
  Guardian,
  GuardianStudent,
} from "../../../../domain/user-management/guardian.entity";
import { Student } from "../../../../domain/user-management/student.entity";

type PrismaGuardianWithRelations = PrismaGuardian & {
  spouse?: PrismaGuardian | null;
  children?: (PrismaGuardianStudent & {
    student: PrismaStudent;
    guardianRelationship: PrismaGuardianRelationship;
  })[];
};

export class PrismaGuardianMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   * Supports eager-loaded spouse and children data
   */
  static toDomain(prismaGuardian: PrismaGuardianWithRelations): Guardian {
    const guardian: Guardian = {
      id: prismaGuardian.id,
      fullName: prismaGuardian.fullName,
      email: prismaGuardian.email,
      phoneNumber: prismaGuardian.phoneNumber,
      address: prismaGuardian.address,
      dateOfBirth: prismaGuardian.dateOfBirth,
      gender: prismaGuardian.gender,
      occupation: prismaGuardian.occupation,
      workAddress: prismaGuardian.workAddress,
      spouseId: prismaGuardian.spouseId,
      userId: prismaGuardian.userId,
      isArchived: prismaGuardian.isArchived,
      createdAt: prismaGuardian.createdAt,
      updatedAt: prismaGuardian.updatedAt,
    };

    if (prismaGuardian.spouse) {
      guardian.spouse = this.toDomain(prismaGuardian.spouse);
    }

    if (prismaGuardian.children) {
      guardian.children = prismaGuardian.children.map((child) => {
        const student: Student = {
          id: child.student.id,
          studentCode: child.student.studentCode,
          fullName: child.student.fullName,
          email: child.student.email,
          phoneNumber: child.student.phoneNumber,
          address: child.student.address,
          dateOfBirth: child.student.dateOfBirth,
          nickname: child.student.nickname,
          gender: child.student.gender,
          status: child.student.status,
          isArchived: child.student.isArchived,
          createdAt: child.student.createdAt,
          updatedAt: child.student.updatedAt,
        };

        const guardianStudent: GuardianStudent = {
          student,
          guardianRelationship: {
            id: child.guardianRelationship.id,
            name: child.guardianRelationship.name,
          },
        };
        return guardianStudent;
      });
    }

    return guardian;
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaGuardian: PrismaGuardian): Guardian {
    const guardian: Guardian = {
      id: prismaGuardian.id,
      fullName: prismaGuardian.fullName,
      email: prismaGuardian.email,
      phoneNumber: prismaGuardian.phoneNumber,
      address: prismaGuardian.address,
      dateOfBirth: prismaGuardian.dateOfBirth,
      gender: prismaGuardian.gender,
      occupation: prismaGuardian.occupation,
      workAddress: prismaGuardian.workAddress,
      spouseId: prismaGuardian.spouseId,
      userId: prismaGuardian.userId,
      isArchived: prismaGuardian.isArchived,
      createdAt: prismaGuardian.createdAt,
      updatedAt: prismaGuardian.updatedAt,
    };

    // Prevent circular references by omitting spouse and children
    return guardian;
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(
    guardian: Omit<Guardian, "id" | "createdAt" | "updatedAt" | "spouse">,
  ): Prisma.GuardianUncheckedCreateInput {
    return {
      fullName: guardian.fullName,
      email: guardian.email,
      phoneNumber: guardian.phoneNumber,
      address: guardian.address,
      dateOfBirth: guardian.dateOfBirth,
      gender: guardian.gender,
      occupation: guardian.occupation,
      workAddress: guardian.workAddress,
      isArchived: guardian.isArchived ?? false,
      spouseId: guardian.spouseId,
      userId: guardian.userId,
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(
    guardian: Partial<
      Omit<Guardian, "id" | "createdAt" | "updatedAt" | "spouse">
    >,
  ): Prisma.GuardianUpdateInput {
    const data: Prisma.GuardianUpdateInput = {};

    if (guardian.fullName !== undefined) data.fullName = guardian.fullName;
    if (guardian.email !== undefined) data.email = guardian.email;
    if (guardian.phoneNumber !== undefined)
      data.phoneNumber = guardian.phoneNumber;
    if (guardian.address !== undefined) data.address = guardian.address;
    if (guardian.dateOfBirth !== undefined)
      data.dateOfBirth = guardian.dateOfBirth;
    if (guardian.gender !== undefined) data.gender = guardian.gender;
    if (guardian.occupation !== undefined)
      data.occupation = guardian.occupation;
    if (guardian.workAddress !== undefined)
      data.workAddress = guardian.workAddress;
    if (guardian.isArchived !== undefined)
      data.isArchived = guardian.isArchived;

    if (guardian.userId !== undefined) {
      data.user = guardian.userId
        ? { connect: { id: guardian.userId } }
        : { disconnect: true };
    }

    if (guardian.spouseId !== undefined) {
      if (guardian.spouseId === null) {
        data.spouse = { disconnect: true };
      } else {
        data.spouse = { connect: { id: guardian.spouseId } };
      }
    }

    return data;
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(
    prismaGuardians: PrismaGuardianWithRelations[],
  ): Guardian[] {
    return prismaGuardians.map((prismaGuardian) =>
      PrismaGuardianMapper.toDomain(prismaGuardian),
    );
  }
}
